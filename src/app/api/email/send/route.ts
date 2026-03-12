import { NextRequest, NextResponse } from 'next/server';
import { sendGmail } from '@/lib/email/gmail-sender';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { to, subject, body, from, replyTo, campaignId, prospectId, threadId } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'to, subject et body sont requis' },
        { status: 400 }
      );
    }

    const result = await sendGmail({
      to,
      subject,
      html: body,
      from,
      replyTo,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erreur lors de l\'envoi' },
        { status: 500 }
      );
    }

    // Track reply in campaign context if applicable
    if (campaignId && prospectId) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_workspace_id')
          .eq('id', user.id)
          .single();

        const workspaceId = profile?.current_workspace_id;

        // Find the campaign_prospect record for tracking
        const { data: cp } = await supabase
          .from('campaign_prospects')
          .select('id')
          .eq('prospect_id', prospectId)
          .eq('campaign_id', campaignId)
          .limit(1)
          .maybeSingle();

        // Find the most recent email_sent for this campaign_prospect to link the tracking event
        if (cp) {
          const { data: lastSent } = await supabase
            .from('emails_sent')
            .select('id')
            .eq('campaign_prospect_id', cp.id)
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastSent) {
            // Create tracking event for the outbound reply
            await supabase.from('tracking_events').insert({
              email_sent_id: lastSent.id,
              event_type: 'reply',
            });
          }
        }

        // Log the sent reply as a prospect activity
        if (workspaceId) {
          await supabase.from('prospect_activities').insert({
            workspace_id: workspaceId,
            prospect_id: prospectId,
            activity_type: 'reply_sent',
            channel: 'email',
            campaign_id: campaignId,
            subject: subject,
            body: body,
            metadata: {
              sent_from_inbox: true,
              thread_id: threadId || null,
              message_id: result.messageId || null,
            },
          });
        }

        // Update prospect.last_contacted_at
        await supabase
          .from('prospects')
          .update({ last_contacted_at: new Date().toISOString() })
          .eq('id', prospectId);

        // Save the outbound message to inbox_messages if threadId provided
        if (threadId) {
          await supabase.from('inbox_messages').insert({
            thread_id: threadId,
            direction: 'outbound',
            from_email: from || '',
            to_email: to,
            subject: subject,
            body_html: body,
            body_text: body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''),
            message_id_header: result.messageId || null,
            is_read: true,
            created_at: new Date().toISOString(),
          });

          // Update thread last_message_at and increment message_count
          const { data: thread } = await supabase
            .from('inbox_threads')
            .select('message_count')
            .eq('id', threadId)
            .single();

          if (thread) {
            await supabase
              .from('inbox_threads')
              .update({
                last_message_at: new Date().toISOString(),
                message_count: (thread.message_count || 0) + 1,
                status: 'replied',
              })
              .eq('id', threadId);
          }
        }
      } catch (trackingErr) {
        // Non-blocking: don't fail the send if tracking fails
        console.error('[API email/send] Campaign tracking error (non-blocking):', trackingErr);
      }
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[API email/send] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
