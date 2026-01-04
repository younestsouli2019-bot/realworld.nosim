#!/usr/bin/env node
// scripts/test-blog-writer.mjs
// Test the BlogWriter to verify content generation works

import dotenv from 'dotenv';
import { BlogWriter } from '../src/work-execution/blog-writer.mjs';

// Load environment variables
dotenv.config();

async function testBlogWriter() {
    console.log('🧪 Testing BlogWriter...\n');

    const writer = new BlogWriter();

    // Test agent types
    const agentTypes = [
        { role: 'Content Writer', task: 'Blog Post', min: 50, max: 200 },
        { role: 'Research Analyst', task: 'Analysis', min: 100, max: 300 },
        { role: 'Social Media Manager', task: 'Guide', min: 75, max: 250 }
    ];

    for (const agentType of agentTypes) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing: ${agentType.role}`);
        console.log('='.repeat(60));

        try {
            // Generate post (without publishing)
            const post = await writer.testGenerate(agentType);

            console.log('✅ Post generated successfully!');
            console.log(`   Title: ${post.title}`);
            console.log(`   Words: ${post.wordCount}`);
            console.log(`   Topic: ${post.topic}`);

        } catch (error) {
            console.error(`❌ Failed to generate post: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test complete!');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('1. Set up WordPress blog');
    console.log('2. Configure WORDPRESS_URL and WORDPRESS_COM_TOKEN in .env');
    console.log('3. Run with real publishing: node scripts/autonomous-revenue-generator.mjs');
}

testBlogWriter().catch(console.error);
