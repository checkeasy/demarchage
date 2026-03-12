import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAllAgentFiles, saveAgentPrompt, reloadAgentPrompts } from '@/lib/agents/prompts';
import type { AgentType } from '@/lib/agents/types';

// GET /api/agents/prompts — List all agent prompt files
export async function GET() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agents = getAllAgentFiles();

  return NextResponse.json({
    agents: agents.map((a) => ({
      agentType: a.agentType,
      dirName: a.dirName,
      exists: a.exists,
      name: a.frontmatter.name || a.dirName,
      description: a.frontmatter.description || '',
      model: a.frontmatter.model || 'sonnet',
      tools: a.frontmatter.tools || '',
      body: a.body,
      lineCount: a.body.split('\n').length,
    })),
  });
}

// PUT /api/agents/prompts — Update an agent's prompt body
export async function PUT(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentType, body } = await req.json();

  if (!agentType || !body) {
    return NextResponse.json(
      { error: 'agentType and body are required' },
      { status: 400 }
    );
  }

  const success = saveAgentPrompt(agentType as AgentType, body);

  if (!success) {
    return NextResponse.json(
      { error: `Failed to save prompt for ${agentType}` },
      { status: 500 }
    );
  }

  reloadAgentPrompts();

  return NextResponse.json({ success: true, agentType });
}
