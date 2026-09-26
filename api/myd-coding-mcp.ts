import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const GH = "https://api.github.com";

function authorized(req: any) {
  const token = process.env.MCP_AUTH_TOKEN;
  return Boolean(token && req.headers?.authorization === `Bearer ${token}`);
}

function ghHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MYD-Coding-Agent-MCP",
  };
}

async function gh(path: string, init: RequestInit = {}) {
  const r = await fetch(GH + path, {
    ...init,
    headers: { ...ghHeaders(), ...(init.headers || {}) },
  });
  const raw = await r.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!r.ok) throw new Error(data?.message || `GitHub API ${r.status}`);
  return data;
}

const out = (x: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(x, null, 2) }],
});

function makeServer() {
  const s = new McpServer({ name: "myd-coding-agent", version: "1.0.0" });

  s.tool("server_info", "Return server capabilities.", {}, async () => out({
    name: "MYD Coding Agent",
    transport: "Streamable HTTP",
    tools: ["repo","read_file","search_code","issues","pulls","commits","create_branch","create_file","update_file","delete_file","create_pull_request"]
  }));

  s.tool("repo", "Get GitHub repository metadata.", {
    owner: z.string(), repo: z.string()
  }, async ({owner,repo}) => out(await gh(`/repos/${owner}/${repo}`)));

  s.tool("read_file", "Read a UTF-8 text file from GitHub.", {
    owner:z.string(), repo:z.string(), path:z.string(), ref:z.string().optional()
  }, async ({owner,repo,path,ref}) => {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const d = await gh(`/repos/${owner}/${repo}/contents/${path}${q}`);
    if (!d.content || d.encoding !== "base64") throw new Error("Path is not a text file");
    return out({path, sha:d.sha, content:Buffer.from(d.content,"base64").toString("utf8")});
  });

  s.tool("search_code", "Search code in a repository.", {
    owner:z.string(), repo:z.string(), query:z.string()
  }, async ({owner,repo,query}) => out(await gh(`/search/code?q=${encodeURIComponent(query+" repo:"+owner+"/"+repo)}`)));

  s.tool("issues", "List repository issues.", {
    owner:z.string(), repo:z.string(), state:z.enum(["open","closed","all"]).optional()
  }, async ({owner,repo,state}) => out(await gh(`/repos/${owner}/${repo}/issues?state=${state||"open"}&per_page=50`)));

  s.tool("pulls", "List repository pull requests.", {
    owner:z.string(), repo:z.string(), state:z.enum(["open","closed","all"]).optional()
  }, async ({owner,repo,state}) => out(await gh(`/repos/${owner}/${repo}/pulls?state=${state||"open"}&per_page=50`)));

  s.tool("commits", "List recent repository commits.", {
    owner:z.string(), repo:z.string(), sha:z.string().optional()
  }, async ({owner,repo,sha}) => out(await gh(`/repos/${owner}/${repo}/commits?per_page=30${sha?"&sha="+encodeURIComponent(sha):""}`)));

  s.tool("create_branch", "Create a branch from an existing branch or commit.", {
    owner:z.string(), repo:z.string(), branch:z.string(), base_ref:z.string().optional(), base_sha:z.string().optional()
  }, async ({owner,repo,branch,base_ref,base_sha}) => {
    let sha=base_sha;
    if(!sha) {
      const ref=base_ref||"main";
      const d=await gh(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(ref)}`);
      sha=d.object.sha;
    }
    return out(await gh(`/repos/${owner}/${repo}/git/refs`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ref:"refs/heads/"+branch,sha})
    }));
  });

  s.tool("create_file", "Create and commit a new file on an existing branch.", {
    owner:z.string(), repo:z.string(), path:z.string(), content:z.string(), message:z.string(), branch:z.string()
  }, async ({owner,repo,path,content,message,branch}) => out(await gh(`/repos/${owner}/${repo}/contents/${path}`, {
    method:"PUT", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message,content:Buffer.from(content).toString("base64"),branch})
  })));

  s.tool("update_file", "Update an existing file using its current blob SHA.", {
    owner:z.string(), repo:z.string(), path:z.string(), content:z.string(), message:z.string(), branch:z.string(), sha:z.string()
  }, async ({owner,repo,path,content,message,branch,sha}) => out(await gh(`/repos/${owner}/${repo}/contents/${path}`, {
    method:"PUT", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message,content:Buffer.from(content).toString("base64"),branch,sha})
  })));

  s.tool("delete_file", "Delete a file using its current blob SHA.", {
    owner:z.string(), repo:z.string(), path:z.string(), message:z.string(), branch:z.string(), sha:z.string()
  }, async ({owner,repo,path,message,branch,sha}) => out(await gh(`/repos/${owner}/${repo}/contents/${path}`, {
    method:"DELETE", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message,branch,sha})
  })));

  s.tool("create_pull_request", "Create a pull request.", {
    owner:z.string(), repo:z.string(), title:z.string(), body:z.string().optional(), head:z.string(), base:z.string(), draft:z.boolean().optional()
  }, async ({owner,repo,title,body,head,base,draft}) => out(await gh(`/repos/${owner}/${repo}/pulls`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({title,body:body||"",head,base,draft:Boolean(draft)})
  })));

  return s;
}

export default async function handler(req:any,res:any) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, DELETE, OPTIONS");
  if(req.method==="OPTIONS"){res.status(204).end();return;}
  if(!authorized(req)){res.status(401).json({error:"Unauthorized"});return;}

  const server=makeServer();
  const transport=new StreamableHTTPServerTransport({
    sessionIdGenerator:undefined,
    enableJsonResponse:true
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req,res,req.body);
  } catch(e) {
    console.error("MYD MCP error",e);
    if(!res.headersSent) res.status(500).json({error:e instanceof Error?e.message:"MCP request failed"});
  } finally {
    await transport.close().catch(()=>undefined);
    await server.close().catch(()=>undefined);
  }
}
