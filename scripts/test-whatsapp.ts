/**
 * Test script: Initialize WhatsApp client and display QR code
 * Usage: npx tsx scripts/test-whatsapp.ts
 */

process.env.CHROMIUM_PATH = '/usr/bin/chromium';
process.env.WHATSAPP_SESSION_PATH = '/root/ProjectList/colddemarchage/.whatsapp_auth';

import {
  initializeWhatsAppClient,
  getWhatsAppClientStatus,
  getWhatsAppClient,
  formatPhoneNumber,
} from '../src/lib/whatsapp/client';

const WORKSPACE_ID = 'test-workspace';

async function main() {
  console.log('=== WhatsApp Client Test ===\n');
  console.log('Initializing WhatsApp client (launching Chromium)...');

  try {
    const info = await initializeWhatsAppClient(WORKSPACE_ID);
    console.log('Init result:', JSON.stringify(info, null, 2));

    // Poll for QR code or ready status
    console.log('\nWaiting for QR code or connection...');

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const status = getWhatsAppClientStatus(WORKSPACE_ID);

      if (status.status === 'ready') {
        console.log('\n✅ WhatsApp connected!');
        console.log('Phone number:', status.phoneNumber);

        // Test sending a message
        console.log('\n--- Test Send ---');
        const client = await getWhatsAppClient(WORKSPACE_ID);

        // Send to yourself as a test
        const testPhone = status.phoneNumber || '';
        if (testPhone) {
          console.log(`Sending test message to ${testPhone}...`);
          const result = await client.sendMessage(
            formatPhoneNumber(testPhone),
            '✅ Test ColdReach WhatsApp - Message envoye avec succes !'
          );
          console.log('Send result:', JSON.stringify(result));
          console.log('\n🎉 Test complet ! Le message a ete envoye.');
        } else {
          console.log('No phone number available, skipping send test.');
        }

        process.exit(0);
      }

      if (status.status === 'qr_pending' && status.qrCode) {
        console.log(`\n📱 QR Code genere ! (poll ${i + 1})`);
        console.log('Scanne ce QR code avec ton telephone WhatsApp:');
        console.log('(Le QR code data URL est trop long pour le terminal)');
        console.log('Ouvre http://72.61.194.129:3004/settings > onglet WhatsApp pour scanner.');
        console.log('\nEn attente du scan...');
      }

      if (status.status === 'error') {
        console.log('\n❌ Error:', status.lastError);
        process.exit(1);
      }

      if (i % 5 === 0) {
        console.log(`  Status: ${status.status} (${i * 2}s elapsed)`);
      }
    }

    console.log('\n⏰ Timeout - no connection after 2 minutes');
    process.exit(1);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
