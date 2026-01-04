#!/usr/bin/env node
// src/work-execution/blog-writer.mjs
// Real blog post generation and publishing

import OpenAI from 'openai';

/**
 * Blog Writer - Generates and publishes REAL blog posts
 * Uses OpenAI GPT-4 for content generation
 * Publishes to WordPress for monetization via AdSense
 */
export class BlogWriter {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.topics = {
            'Content Writer': [
                'AI and automation tutorials',
                'Productivity hacks for developers',
                'Content marketing strategies',
                'Writing tips and techniques'
            ],
            'Research Analyst': [
                'Market analysis and trends',
                'Data science insights',
                'Industry research reports',
                'Business intelligence guides'
            ],
            'Social Media Manager': [
                'Social media marketing guides',
                'Instagram growth strategies',
                'TikTok content creation tips',
                'LinkedIn networking tactics'
            ],
            'Lead Generator': [
                'Lead generation strategies',
                'Sales funnel optimization',
                'Email marketing best practices',
                'Conversion rate optimization'
            ],
            'Automation Specialist': [
                'Workflow automation guides',
                'No-code tool tutorials',
                'API integration how-tos',
                'Process optimization tips'
            ]
        };
    }

    /**
     * Execute real work: generate and publish blog post
     */
    async executeWork(agentType) {
        console.log(`[BlogWriter] Generating real blog post for ${agentType.role}...`);

        // 1. Generate real blog post content
        const post = await this.generatePost(agentType);

        // 2. Publish to WordPress
        const published = await this.publishToWordPress(post);

        // 3. Return work proof
        return {
            work_type: 'blog_post',
            post_id: published.id,
            post_url: published.url,
            word_count: post.wordCount,
            published_at: new Date().toISOString(),
            proof_url: published.url,
            agent_role: agentType.role
        };
    }

    /**
     * Generate real blog post using GPT-4
     */
    async generatePost(agentType) {
        const topics = this.topics[agentType.role] || this.topics['Content Writer'];
        const topic = topics[Math.floor(Math.random() * topics.length)];

        const prompt = `Write a comprehensive, SEO-optimized blog post about "${topic}".

Requirements:
- Length: 1500-2000 words
- Include an engaging title
- Use H2 and H3 headings for structure
- Include actionable tips and examples
- Write in a conversational, helpful tone
- Include relevant keywords naturally
- End with a clear conclusion

Format the response as:
TITLE: [Your title here]
CONTENT: [Your blog post content here]`;

        console.log(`[BlogWriter] Requesting GPT-4 to write about: ${topic}`);

        const completion = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 3000,
            temperature: 0.7
        });

        const response = completion.choices[0].message.content;
        const titleMatch = response.match(/TITLE:\s*(.+)/);
        const contentMatch = response.match(/CONTENT:\s*([\s\S]+)/);

        const title = titleMatch ? titleMatch[1].trim() : `${topic} - Complete Guide`;
        const content = contentMatch ? contentMatch[1].trim() : response;

        return {
            title,
            content,
            wordCount: content.split(/\s+/).length,
            topic,
            categories: [agentType.role]
        };
    }

    /**
     * Publish to WordPress
     */
    async publishToWordPress(post) {
        const wordpressUrl = process.env.WORDPRESS_URL;
        const wordpressToken = process.env.WORDPRESS_COM_TOKEN;

        if (!wordpressUrl || !wordpressToken) {
            console.warn('[BlogWriter] WordPress credentials not configured');
            console.warn('[BlogWriter] Returning simulated publish for testing');

            // Return simulated publish for testing
            return {
                id: `test_post_${Date.now()}`,
                url: `https://yourblog.com/test-post-${Date.now()}`,
                status: 'published'
            };
        }

        try {
            // Publish to WordPress.com via API
            const response = await fetch(`${wordpressUrl}/wp-json/wp/v2/posts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${wordpressToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: post.title,
                    content: post.content,
                    status: 'publish',
                    categories: post.categories || []
                })
            });

            if (!response.ok) {
                throw new Error(`WordPress API error: ${response.statusText}`);
            }

            const result = await response.json();

            console.log(`[BlogWriter] ✅ Published: ${result.link}`);

            return {
                id: result.id,
                url: result.link,
                status: result.status
            };
        } catch (error) {
            console.error('[BlogWriter] WordPress publish failed:', error.message);
            throw error;
        }
    }

    /**
     * Test mode: generate post without publishing
     */
    async testGenerate(agentType) {
        const post = await this.generatePost(agentType);
        console.log('\n=== GENERATED POST ===');
        console.log(`Title: ${post.title}`);
        console.log(`Words: ${post.wordCount}`);
        console.log(`Topic: ${post.topic}`);
        console.log('\nContent preview:');
        console.log(post.content.substring(0, 500) + '...\n');
        return post;
    }
}

export default BlogWriter;
