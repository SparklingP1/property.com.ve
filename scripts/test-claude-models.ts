/**
 * Test which Claude models are accessible with the API key
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error('❌ ANTHROPIC_API_KEY not found');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey });

const modelsToTest = [
  // Claude 4.5 (2025) - Newest
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-5-20251124',

  // Claude 4 (2025)
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250805',

  // Claude 3.5 (2024)
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-20241022',

  // Claude 3 (2024)
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
];

async function testModel(modelName: string) {
  try {
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    console.log(`✅ ${modelName} - WORKS`);
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`❌ ${modelName} - NOT FOUND (404)`);
    } else if (error.status === 401) {
      console.log(`❌ ${modelName} - UNAUTHORIZED (401)`);
    } else {
      console.log(`❌ ${modelName} - ERROR: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Claude Models\n');

  for (const model of modelsToTest) {
    await testModel(model);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }

  console.log('\n✅ Test complete');
}

main();
