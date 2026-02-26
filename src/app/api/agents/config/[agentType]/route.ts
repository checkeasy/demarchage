import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AgentType, AGENT_TYPES } from '@/lib/agents/types';

// GET: Get specific agent config + active prompt
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentType: string }> }
) {
  try {
    const { agentType } = await params;

    if (!AGENT_TYPES.includes(agentType as AgentType)) {
      return NextResponse.json(
        { error: `Type d'agent invalide: ${agentType}. Types valides: ${AGENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

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

    // Fetch agent config
    const { data: config, error: configError } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('agent_type', agentType)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: `Configuration agent "${agentType}" introuvable pour ce workspace` },
        { status: 404 }
      );
    }

    // Fetch the active prompt version
    const { data: promptVersion } = await supabase
      .from('agent_prompt_versions')
      .select('*')
      .eq('agent_config_id', config.id)
      .eq('is_active', true)
      .single();

    return NextResponse.json({
      config,
      promptVersion: promptVersion || null,
    });
  } catch (error) {
    console.error('[Agents] Config get error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// PUT: Update agent config (model, temperature, settings, system_prompt)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ agentType: string }> }
) {
  try {
    const { agentType } = await params;

    if (!AGENT_TYPES.includes(agentType as AgentType)) {
      return NextResponse.json(
        { error: `Type d'agent invalide: ${agentType}. Types valides: ${AGENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

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

    const body = await request.json();
    const { model, temperature, max_tokens, settings, system_prompt, is_active } = body;

    // Fetch existing config
    const { data: existingConfig, error: fetchError } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('agent_type', agentType)
      .single();

    if (fetchError || !existingConfig) {
      return NextResponse.json(
        { error: `Configuration agent "${agentType}" introuvable pour ce workspace` },
        { status: 404 }
      );
    }

    // Build update payload (only include provided fields)
    const updatePayload: Record<string, unknown> = {};
    if (model !== undefined) updatePayload.model = model;
    if (temperature !== undefined) updatePayload.temperature = temperature;
    if (max_tokens !== undefined) updatePayload.max_tokens = max_tokens;
    if (settings !== undefined) updatePayload.settings = settings;
    if (is_active !== undefined) updatePayload.is_active = is_active;
    updatePayload.updated_at = new Date().toISOString();

    // Update agent config
    const { data: updatedConfig, error: updateError } = await supabase
      .from('agent_configs')
      .update(updatePayload)
      .eq('id', existingConfig.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Agents] Config update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If system_prompt is provided, create a new prompt version
    let newPromptVersion = null;
    if (system_prompt !== undefined && system_prompt !== null) {
      // Get the current highest version number
      const { data: latestPrompt } = await supabase
        .from('agent_prompt_versions')
        .select('version')
        .eq('agent_config_id', existingConfig.id)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = (latestPrompt?.version || 0) + 1;

      // Deactivate all existing prompt versions for this config
      await supabase
        .from('agent_prompt_versions')
        .update({ is_active: false })
        .eq('agent_config_id', existingConfig.id);

      // Create new active prompt version
      const { data: promptVersion, error: promptError } = await supabase
        .from('agent_prompt_versions')
        .insert({
          agent_config_id: existingConfig.id,
          version: nextVersion,
          system_prompt,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (promptError) {
        console.error('[Agents] Prompt version creation error:', promptError);
        // Non-blocking: config is already updated
      } else {
        newPromptVersion = promptVersion;
      }
    }

    return NextResponse.json({
      config: updatedConfig,
      promptVersion: newPromptVersion,
    });
  } catch (error) {
    console.error('[Agents] Config update error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
