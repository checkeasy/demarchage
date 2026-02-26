import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  AgentType,
  AGENT_TYPES,
  AGENT_MODELS,
  DEFAULT_AGENT_PROMPTS,
} from '@/lib/agents/types';

// GET: List all agent configs for the workspace
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Aucun workspace actif' }, { status: 400 });
    }

    const { data: configs, error } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Agents] Config list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ configs: configs || [] });
  } catch (error) {
    console.error('[Agents] Config list error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// POST: Initialize default agent configs for the workspace (called once during setup)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Aucun workspace actif' }, { status: 400 });
    }

    // Check if configs already exist for this workspace
    const { data: existingConfigs } = await supabase
      .from('agent_configs')
      .select('agent_type')
      .eq('workspace_id', workspaceId);

    const existingTypes = new Set(
      (existingConfigs || []).map((c: { agent_type: string }) => c.agent_type)
    );

    const agentTypesToCreate = AGENT_TYPES.filter(
      (type) => !existingTypes.has(type)
    );

    if (agentTypesToCreate.length === 0) {
      return NextResponse.json({
        message: 'Toutes les configurations agents existent deja',
        configs: existingConfigs,
      });
    }

    // Create default configs for missing agent types
    const configInserts = agentTypesToCreate.map((agentType: AgentType) => ({
      workspace_id: workspaceId,
      agent_type: agentType,
      model: AGENT_MODELS[agentType],
      temperature: agentType === 'prospect_researcher' ? 0.3 : agentType === 'response_handler' ? 0.4 : 0.7,
      max_tokens: 2048,
      is_active: true,
      settings: {},
    }));

    const { data: newConfigs, error: configError } = await supabase
      .from('agent_configs')
      .insert(configInserts)
      .select();

    if (configError) {
      console.error('[Agents] Config creation error:', configError);
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    // Create initial prompt versions for each new config
    const promptInserts = (newConfigs || []).map((config: { id: string; agent_type: string }) => ({
      agent_config_id: config.id,
      version: 1,
      system_prompt: DEFAULT_AGENT_PROMPTS[config.agent_type as AgentType] || '',
      is_active: true,
      created_by: user.id,
    }));

    if (promptInserts.length > 0) {
      const { error: promptError } = await supabase
        .from('agent_prompt_versions')
        .insert(promptInserts);

      if (promptError) {
        console.error('[Agents] Prompt version creation error:', promptError);
        // Non-blocking: configs are created, prompts can be added later
      }
    }

    // Return all configs (existing + new)
    const { data: allConfigs } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      message: `${agentTypesToCreate.length} configuration(s) agent creee(s)`,
      configs: allConfigs || [],
    });
  } catch (error) {
    console.error('[Agents] Config init error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
