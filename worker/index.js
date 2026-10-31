const ORIGIN="https://ararat33.github.io",GOOGLE_CLIENT_ID="741485932725-e8p4qfj97i322kscf8amjqk88r4k8fkn.apps.googleusercontent.com",E=new TextEncoder();
const out=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json","access-control-allow-origin":ORIGIN,"access-control-allow-headers":"Content-Type,Authorization","access-control-allow-methods":"GET,POST,OPTIONS","vary":"Origin"}});
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"),unb=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0)),dec=s=>JSON.parse(new TextDecoder().decode(unb(s)));
const key=s=>crypto.subtle.importKey("raw",E.encode(s),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
async function auth(req,env){try{const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");const a=t.split(".");if(a.length!==3)return null;const c=dec(a[1]);await google(t,c.nonce);const d=await crypto.subtle.digest("SHA-256",E.encode("https://accounts.google.com|"+c.sub)),uid="HAY-"+Array.from(new Uint8Array(d).slice(0,16),x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();return await env.DB.prepare("SELECT id,display_name,avatar_url FROM users WHERE id=?").bind(uid).first()}catch{return null}}
async function sha(s){return b64(await crypto.subtle.digest("SHA-256",E.encode(s)))}
async function google(jwt,nonce){const a=String(jwt||"").split(".");if(a.length!==3)throw Error("Google credential invalid");const h=dec(a[0]),c=dec(a[1]);if(h.alg!=="RS256"||!h.kid||c.aud!==GOOGLE_CLIENT_ID||!["https://accounts.google.com","accounts.google.com"].includes(c.iss)||!c.sub||!c.email_verified||c.exp<Date.now()/1000||c.nonce!==nonce)throw Error("Google identity validation failed");const r=await fetch("https://www.googleapis.com/oauth2/v3/certs",{cf:{cacheTtl:3600}});if(!r.ok)throw Error("Google keys unavailable");const j=(await r.json()).keys.find(x=>x.kid===h.kid&&x.use==="sig");if(!j)throw Error("Google key missing");const k=await crypto.subtle.importKey("jwk",j,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",k,unb(a[2]),E.encode(a[0]+"."+a[1])))throw Error("Google signature invalid");return c}
const hid=id=>"@"+id.toLowerCase()+".hayid",clean=s=>String(s||"").trim().replace(/^@/,"").replace(/\.hayid$/i,"").toUpperCase(),uuid=()=>crypto.randomUUID();
async function route(req,env){const u=new URL(req.url),p=u.pathname;if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":ORIGIN,"access-control-allow-headers":"Content-Type,Authorization","access-control-allow-methods":"GET,POST,OPTIONS","access-control-max-age":"86400"}});if(req.headers.get("origin")!==ORIGIN)return out({error:"Origin denied"},403);if(p==="/api/health")return out({ok:true,service:"HAYER API"});
if(p==="/api/auth/google"&&req.method==="POST"){try{const b=await req.json(),c=await google(b.credential,b.nonce),d=await crypto.subtle.digest("SHA-256",E.encode("https://accounts.google.com|"+c.sub)),uid="HAY-"+Array.from(new Uint8Array(d).slice(0,16),x=>x.toString(16).padStart(2,"0")).join("").toUpperCase(),name=String(c.name||"HAYER member").slice(0,80);await env.DB.prepare("INSERT INTO users(id,google_sub_hash,display_name,avatar_url) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,avatar_url=excluded.avatar_url,updated_at=CURRENT_TIMESTAMP").bind(uid,await sha(c.sub),name,String(c.picture||"").slice(0,500)).run();return out({session:b.credential,user:{id:uid,handle:hid(uid),name,avatar:c.picture||null}})}catch(e){return out({error:e.message},401)}}
if(!p.startsWith("/api/"))return out({error:"Not found"},404);const user=await auth(req,env);if(!user)return out({error:"Sign in required"},401);
if(p==="/api/me"&&req.method==="GET")return out({user:{id:user.id,handle:hid(user.id),name:user.display_name,avatar:user.avatar_url}});
if(p==="/api/feed"&&req.method==="GET"){const q=String(u.searchParams.get("q")||"").slice(0,100),rows=await env.DB.prepare("SELECT p.id,p.author_id,p.body,p.media_json,p.link_url,p.created_at,u.display_name,u.avatar_url,(SELECT COUNT(*) FROM post_reactions x WHERE x.post_id=p.id) reaction_count,(SELECT COUNT(*) FROM post_comments x WHERE x.post_id=p.id) comment_count FROM posts p JOIN users u ON u.id=p.author_id WHERE p.visibility='public' AND (?='' OR p.body LIKE ? OR u.display_name LIKE ?) ORDER BY p.created_at DESC LIMIT 50").bind(q,q?"%"+q+"%":"",q?"%"+q+"%":"").all();return out({posts:rows.results||[]})}
if(p==="/api/posts"&&req.method==="POST"){const b=await req.json(),body=String(b.body||"").trim().slice(0,5000),link=String(b.link_url||"").trim(),media=String(b.media_url||"").trim();if(!body&&!link&&!media)return out({error:"Empty post"},400);for(const v of [link,media].filter(Boolean)){try{if(new URL(v).protocol!=="https:")throw 0}catch{return out({error:"Only HTTPS media and links are allowed"},400)}}const mediaJson=media?JSON.stringify([{url:media,type:/\\.(mp4|webm|mov)(\\?|$)/i.test(media)?"video":"image"}]):"[]";const id=uuid();await env.DB.prepare("INSERT INTO posts(id,author_id,body,media_json,link_url,visibility) VALUES(?,?,?,?,?,?)").bind(id,user.id,body,mediaJson,link||null,b.visibility==="private"?"private":"public").run();return out({ok:true,id},201)}
if(p==="/api/chat/find"&&req.method==="POST"){const b=await req.json(),target=clean(b.hayid);if(!/^HAY-[A-F0-9]{32}$/.test(target)||target===user.id)return out({error:"Invalid HAYID"},400);const f=await env.DB.prepare("SELECT id,display_name,avatar_url FROM users WHERE id=?").bind(target).first();return f?out({user:{id:f.id,handle:hid(f.id),name:f.display_name,avatar:f.avatar_url}}):out({error:"HAYID not found"},404)}
if(p==="/api/chat/open"&&req.method==="POST"){const target=clean((await req.json()).user_id),f=await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(target).first();if(!f)return out({error:"User not found"},404);const pair=[user.id,target].sort(),cid="DM-"+await sha(pair.join("|"));await env.DB.prepare("INSERT OR IGNORE INTO conversations(id,kind,created_by) VALUES(?,'direct',?)").bind(cid,user.id).run();await env.DB.batch(pair.map(x=>env.DB.prepare("INSERT OR IGNORE INTO conversation_members(conversation_id,user_id) VALUES(?,?)").bind(cid,x)));return out({conversation_id:cid})}
if(p==="/api/chat/group"&&req.method==="POST"){const b=await req.json(),ids=[...new Set([user.id,...(Array.isArray(b.hayids)?b.hayids:[]).map(clean)])];if(ids.length<3||ids.length>30)return out({error:"Group size must be 3–30"},400);const f=await env.DB.prepare("SELECT id FROM users WHERE id IN ("+ids.map(()=>"?").join(",")+")").bind(...ids).all();if(f.results.length!==ids.length)return out({error:"A member HAYID is not registered"},404);const cid="GR-"+uuid();await env.DB.prepare("INSERT INTO conversations(id,kind,title,created_by) VALUES(?,'group',?,?)").bind(cid,String(b.title||"New group").slice(0,80),user.id).run();await env.DB.batch(ids.map(x=>env.DB.prepare("INSERT INTO conversation_members(conversation_id,user_id) VALUES(?,?)").bind(cid,x)));return out({conversation_id:cid},201)}
if(p==="/api/chat/conversations"&&req.method==="GET"){const r=await env.DB.prepare("SELECT c.id,c.kind,COALESCE(NULLIF(c.title,''),(SELECT u.display_name FROM conversation_members cm2 JOIN users u ON u.id=cm2.user_id WHERE cm2.conversation_id=c.id AND cm2.user_id<>? LIMIT 1),'Անձնական զրույց') title,c.created_at,(SELECT m.body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message,(SELECT COUNT(*) FROM conversation_members cm3 WHERE cm3.conversation_id=c.id) member_count FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id WHERE cm.user_id=? ORDER BY COALESCE((SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id=c.id),c.created_at) DESC").bind(user.id,user.id).all();return out({conversations:r.results||[]})}
if(p==="/api/chat/messages"&&req.method==="GET"){const cid=u.searchParams.get("conversation_id")||"",m=await env.DB.prepare("SELECT 1 ok FROM conversation_members WHERE conversation_id=? AND user_id=?").bind(cid,user.id).first();if(!m)return out({error:"Conversation not found"},404);const r=await env.DB.prepare("SELECT m.id,m.sender_id,m.kind,m.body,m.attachment_url,m.created_at,u.display_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.created_at LIMIT 200").bind(cid).all();return out({messages:r.results||[]})}

if(p==="/api/chat/messages"&&req.method==="POST"){
 const b=await req.json(),cid=String(b.conversation_id||""),body=String(b.body||"").trim().slice(0,5000),kind=["text","voice","file","image","video"].includes(b.kind)?b.kind:"text",attachment=String(b.attachment_url||"").trim();
 const m=await env.DB.prepare("SELECT 1 ok FROM conversation_members WHERE conversation_id=? AND user_id=?").bind(cid,user.id).first();
 if(!m)return out({error:"Conversation not found"},404);
 if(!body&&!attachment)return out({error:"Empty message"},400);
 if(attachment){try{if(new URL(attachment).protocol!=="https:")throw 0}catch{return out({error:"Attachment must be a valid HTTPS URL"},400)}}
 const mid=uuid(),saved=await env.DB.prepare("INSERT INTO messages(id,conversation_id,sender_id,kind,body,attachment_url) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM messages WHERE sender_id=? AND created_at>=datetime('now','-60 seconds'))<20").bind(mid,cid,user.id,kind,body,attachment||null,user.id).run();
 if(!saved.meta?.changes)return out({error:"Հաղորդագրությունների սահմանաչափը լրացել է․ մեկ րոպեում կարելի է ուղարկել առավելագույնը 20 հաղորդագրություն։",code:"MESSAGE_RATE_LIMIT",limit:20,window_seconds:60,retry_after_seconds:60},429);
 return out({ok:true,id:mid},201)
}
const postAction=p.match(/^\/api\/posts\/([^/]+)\/(comments|reactions|save)$/);
if(postAction){
 const postId=decodeURIComponent(postAction[1]),action=postAction[2],post=await env.DB.prepare("SELECT id FROM posts WHERE id=? AND visibility='public'").bind(postId).first();
 if(!post)return out({error:"Post not found"},404);
 if(action==="comments"&&req.method==="GET"){
  const r=await env.DB.prepare("SELECT c.id,c.body,c.created_at,u.id author_id,u.display_name,u.avatar_url FROM post_comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? ORDER BY c.created_at ASC LIMIT 100").bind(postId).all();
  return out({comments:r.results||[]})
 }
 if(action==="comments"&&req.method==="POST"){
  const body=String((await req.json()).body||"").trim().slice(0,2000);if(!body)return out({error:"Comment cannot be empty"},400);
  const id=uuid();await env.DB.prepare("INSERT INTO post_comments(id,post_id,author_id,body) VALUES(?,?,?,?)").bind(id,postId,user.id,body).run();return out({ok:true,id},201)
 }
 if(action==="reactions"&&req.method==="POST"){
  const reaction=String((await req.json()).reaction||"like");if(!["like","love","laugh","wow","sad","angry"].includes(reaction))return out({error:"Unsupported reaction"},400);
  const old=await env.DB.prepare("SELECT 1 ok FROM post_reactions WHERE post_id=? AND user_id=? AND reaction=?").bind(postId,user.id,reaction).first();
  if(old)await env.DB.prepare("DELETE FROM post_reactions WHERE post_id=? AND user_id=? AND reaction=?").bind(postId,user.id,reaction).run();
  else await env.DB.prepare("INSERT INTO post_reactions(post_id,user_id,reaction) VALUES(?,?,?)").bind(postId,user.id,reaction).run();
  const n=await env.DB.prepare("SELECT COUNT(*) total FROM post_reactions WHERE post_id=?").bind(postId).first();return out({ok:true,active:!old,reaction,count:n?.total||0})
 }
 if(action==="save"&&req.method==="POST"){
  const old=await env.DB.prepare("SELECT 1 ok FROM post_bookmarks WHERE post_id=? AND user_id=?").bind(postId,user.id).first();
  if(old)await env.DB.prepare("DELETE FROM post_bookmarks WHERE post_id=? AND user_id=?").bind(postId,user.id).run();
  else await env.DB.prepare("INSERT INTO post_bookmarks(post_id,user_id) VALUES(?,?)").bind(postId,user.id).run();
  return out({ok:true,saved:!old})
 }
}
if(p==="/api/saved"&&req.method==="GET"){
 const r=await env.DB.prepare("SELECT p.id,p.body,p.media_json,p.link_url,p.created_at,u.display_name FROM post_bookmarks b JOIN posts p ON p.id=b.post_id JOIN users u ON u.id=p.author_id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 100").bind(user.id).all();return out({posts:r.results||[]})
}
const communityJoin=p.match(/^\/api\/communities\/([^/]+)\/(join|leave)$/);
if(communityJoin&&req.method==="POST"){
 const cid=decodeURIComponent(communityJoin[1]),action=communityJoin[2],c=await env.DB.prepare("SELECT id,owner_id,visibility FROM communities WHERE id=?").bind(cid).first();if(!c)return out({error:"Community not found"},404);
 if(action==="join"){
  if(c.visibility==="secret")return out({error:"Այս համայնքը գաղտնի է և միանալու համար անհրաժեշտ է հրավեր։"},403);
  if(c.visibility==="private"){await env.DB.prepare("INSERT OR IGNORE INTO community_join_requests(community_id,user_id) VALUES(?,?)").bind(cid,user.id).run();return out({ok:true,requested:true})}
  await env.DB.prepare("INSERT OR IGNORE INTO community_members(community_id,user_id,role) VALUES(?,?,'member')").bind(cid,user.id).run();return out({ok:true,joined:true})
 }
 if(c.owner_id===user.id)return out({error:"Համայնքի սեփականատերը չի կարող լքել այն։"},409);
 await env.DB.prepare("DELETE FROM community_members WHERE community_id=? AND user_id=?").bind(cid,user.id).run();return out({ok:true,left:true})
}
const communityPosts=p.match(/^\/api\/communities\/([^/]+)\/posts$/);
if(communityPosts){
 const cid=decodeURIComponent(communityPosts[1]),c=await env.DB.prepare("SELECT id,owner_id,visibility FROM communities WHERE id=?").bind(cid).first();
 if(!c)return out({error:"Community not found"},404);
 const member=!!(await env.DB.prepare("SELECT 1 ok FROM community_members WHERE community_id=? AND user_id=?").bind(cid,user.id).first());
 if(c.visibility!=="public"&&!member)return out({error:"Այս համայնքի նյութերը հասանելի են միայն անդամներին։"},403);
 if(req.method==="GET"){
  const r=await env.DB.prepare("SELECT p.id,p.body,p.media_json,p.link_url,p.created_at,u.id author_id,u.display_name,u.avatar_url,(SELECT COUNT(*) FROM community_post_reactions x WHERE x.post_id=p.id) reaction_count,(SELECT COUNT(*) FROM community_post_comments x WHERE x.post_id=p.id) comment_count FROM community_posts p JOIN users u ON u.id=p.author_id WHERE p.community_id=? ORDER BY p.created_at DESC LIMIT 100").bind(cid).all();return out({posts:r.results||[],is_member:member})
 }
 if(req.method==="POST"){
  if(!member)return out({error:"Նախ միացիր համայնքին՝ հրապարակում անելու համար։"},403);
  const b=await req.json(),body=String(b.body||"").trim().slice(0,5000),link=String(b.link_url||"").trim(),media=String(b.media_url||"").trim();
  if(!body&&!link&&!media)return out({error:"Empty post"},400);
  for(const v of [link,media].filter(Boolean)){try{if(new URL(v).protocol!=="https:")throw 0}catch{return out({error:"Only HTTPS media and links are allowed"},400)}}
  const id=uuid(),mediaJson=media?JSON.stringify([{url:media,type:/\.(mp4|webm|mov)(\?|$)/i.test(media)?"video":"image"}]):"[]";
  await env.DB.prepare("INSERT INTO community_posts(id,community_id,author_id,body,media_json,link_url) VALUES(?,?,?,?,?,?)").bind(id,cid,user.id,body,mediaJson,link||null).run();return out({ok:true,id},201)
 }
}
const communityComment=p.match(/^\/api\/communities\/([^/]+)\/posts\/([^/]+)\/comments$/);
if(communityComment){
 const cid=decodeURIComponent(communityComment[1]),postId=decodeURIComponent(communityComment[2]),c=await env.DB.prepare("SELECT visibility FROM communities WHERE id=?").bind(cid).first(),member=!!(await env.DB.prepare("SELECT 1 ok FROM community_members WHERE community_id=? AND user_id=?").bind(cid,user.id).first());
 if(!c)return out({error:"Community not found"},404);if(c.visibility!=="public"&&!member)return out({error:"Forbidden"},403);
 if(req.method==="GET"){const r=await env.DB.prepare("SELECT c.id,c.body,c.created_at,u.display_name,u.avatar_url FROM community_post_comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? ORDER BY c.created_at LIMIT 100").bind(postId).all();return out({comments:r.results||[]})}
 if(req.method==="POST"){const body=String((await req.json()).body||"").trim().slice(0,2000);if(!body)return out({error:"Comment cannot be empty"},400);const id=uuid();await env.DB.prepare("INSERT INTO community_post_comments(id,post_id,author_id,body) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM community_posts WHERE id=? AND community_id=?)").bind(id,postId,user.id,body,postId,cid).run();return out({ok:true,id},201)}
}
const communityReaction=p.match(/^\/api\/communities\/([^/]+)\/posts\/([^/]+)\/reactions$/);
if(communityReaction&&req.method==="POST"){
 const cid=decodeURIComponent(communityReaction[1]),postId=decodeURIComponent(communityReaction[2]),b=await req.json(),reaction=String(b.reaction||"like");
 if(!["like","love","laugh","wow","sad","angry"].includes(reaction))return out({error:"Unsupported reaction"},400);
 const c=await env.DB.prepare("SELECT visibility FROM communities WHERE id=?").bind(cid).first(),member=!!(await env.DB.prepare("SELECT 1 ok FROM community_members WHERE community_id=? AND user_id=?").bind(cid,user.id).first());
 if(!c)return out({error:"Community not found"},404);if(c.visibility!=="public"&&!member)return out({error:"Forbidden"},403);
 const exists=await env.DB.prepare("SELECT 1 ok FROM community_post_reactions WHERE post_id=? AND user_id=? AND reaction=?").bind(postId,user.id,reaction).first();
 if(exists)await env.DB.prepare("DELETE FROM community_post_reactions WHERE post_id=? AND user_id=? AND reaction=?").bind(postId,user.id,reaction).run();else await env.DB.prepare("INSERT INTO community_post_reactions(post_id,user_id,reaction) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM community_posts WHERE id=? AND community_id=?)").bind(postId,user.id,reaction,postId,cid).run();
 const n=await env.DB.prepare("SELECT COUNT(*) total FROM community_post_reactions WHERE post_id=?").bind(postId).first();return out({ok:true,active:!exists,count:n?.total||0})
}

const communityRequests=p.match(/^\/api\/communities\/([^/]+)\/join-requests$/);
if(communityRequests&&req.method==="GET"){
 const cid=decodeURIComponent(communityRequests[1]),c=await env.DB.prepare("SELECT owner_id FROM communities WHERE id=?").bind(cid).first();if(!c)return out({error:"Community not found"},404);if(c.owner_id!==user.id)return out({error:"Only the community owner can review requests"},403);
 const r=await env.DB.prepare("SELECT r.user_id,r.created_at,u.display_name,u.avatar_url FROM community_join_requests r JOIN users u ON u.id=r.user_id WHERE r.community_id=? ORDER BY r.created_at").bind(cid).all();return out({requests:r.results||[]})
}
const communityApproval=p.match(/^\/api\/communities\/([^/]+)\/join-requests\/([^/]+)\/(approve|decline)$/);
if(communityApproval&&req.method==="POST"){
 const cid=decodeURIComponent(communityApproval[1]),target=decodeURIComponent(communityApproval[2]),action=communityApproval[3],c=await env.DB.prepare("SELECT owner_id FROM communities WHERE id=?").bind(cid).first();if(!c)return out({error:"Community not found"},404);if(c.owner_id!==user.id)return out({error:"Only the community owner can review requests"},403);
 const pending=await env.DB.prepare("SELECT 1 ok FROM community_join_requests WHERE community_id=? AND user_id=?").bind(cid,target).first();if(!pending)return out({error:"Join request not found"},404);
 if(action==="approve")await env.DB.prepare("INSERT OR IGNORE INTO community_members(community_id,user_id,role) VALUES(?,?,'member')").bind(cid,target).run();
 await env.DB.prepare("DELETE FROM community_join_requests WHERE community_id=? AND user_id=?").bind(cid,target).run();return out({ok:true,approved:action==="approve"})
}
if(p==="/api/communities"&&req.method==="GET"){
 const r=await env.DB.prepare("SELECT c.id,c.name,c.description,c.visibility,c.created_at,u.display_name owner_name,(SELECT COUNT(*) FROM community_members m WHERE m.community_id=c.id) member_count,(c.owner_id=?) is_owner,EXISTS(SELECT 1 FROM community_members m WHERE m.community_id=c.id AND m.user_id=?) is_member FROM communities c JOIN users u ON u.id=c.owner_id WHERE c.visibility='public' OR c.owner_id=? OR EXISTS(SELECT 1 FROM community_members m WHERE m.community_id=c.id AND m.user_id=?) ORDER BY c.created_at DESC LIMIT 100").bind(user.id,user.id,user.id,user.id).all();return out({communities:r.results||[]})
}
if(p==="/api/communities"&&req.method==="POST"){
 const b=await req.json(),name=String(b.name||"").trim().replace(/\s+/g," ").slice(0,60),desc=String(b.description||"").trim().slice(0,500),visibility=["public","private","secret"].includes(b.visibility)?b.visibility:"public";
 if(name.length<3)return out({error:"Community name too short"},400);
 const cid=uuid();try{await env.DB.batch([env.DB.prepare("INSERT INTO communities(id,owner_id,name,description,visibility) VALUES(?,?,?,?,?)").bind(cid,user.id,name,desc,visibility),env.DB.prepare("INSERT INTO community_members(community_id,user_id,role) VALUES(?,?,'owner')").bind(cid,user.id)]);return out({ok:true,id:cid,visibility},201)}catch{return out({error:"Community name already exists"},409)}
}
return out({error:"Not found"},404)}
export default {async fetch(req,env){try{return await route(req,env)}catch(e){return out({error:"Internal error",detail:String(e.message||e)},500)}}};