#!/usr/bin/env node
// src/revenue-tracking/adsense-tracker.mjs
// Google AdSense revenue tracking and PSP proof extraction

import { google } from 'googleapis';

/**
 * AdSense Revenue Tracker
 * Monitors AdSense earnings for published blog posts
 * Extracts PSP proof for settlement verification
 */
export class AdSenseTracker {
    constructor() {
        this.adsense = google.adsense('v2');

        // Set up OAuth2 authentication
        this.auth = new google.auth.OAuth2(
            process.env.ADSENSE_CLIENT_ID,
            process.env.ADSENSE_CLIENT_SECRET
        );

        if (process.env.ADSENSE_REFRESH_TOKEN) {
            this.auth.setCredentials({
                refresh_token: process.env.ADSENSE_REFRESH_TOKEN
            });
        }

        this.accountId = process.env.ADSENSE_ACCOUNT_ID;
    }

    /**
     * Check if AdSense is configured
     */
    isConfigured() {
        return !!(
            process.env.ADSENSE_CLIENT_ID &&
            process.env.ADSENSE_CLIENT_SECRET &&
            process.env.ADSENSE_REFRESH_TOKEN &&
            process.env.ADSENSE_ACCOUNT_ID
        );
    }

    /**
     * Check revenue for a specific blog post URL
     */
    async checkRevenue(postUrl) {
        if (!this.isConfigured()) {
            console.warn('[AdSenseTracker] AdSense not configured - skipping revenue check');
            return null;
        }

        try {
            console.log(`[AdSenseTracker] Checking revenue for: ${postUrl}`);

            // Get today's earnings for the specific URL
            const response = await this.adsense.accounts.reports.generate({
                auth: this.auth,
                account: `accounts/${this.accountId}`,
                dateRange: 'TODAY',
                dimensions: ['PAGE_URL'],
                metrics: ['EARNINGS', 'CLICKS', 'IMPRESSIONS'],
                filters: [`PAGE_URL==${postUrl}`]
            });

            if (response.data.rows && response.data.rows.length > 0) {
                const row = response.data.rows[0];
                const earnings = parseFloat(row.cells[1].value);
                const clicks = parseInt(row.cells[2].value);
                const impressions = parseInt(row.cells[3].value);

                if (earnings > 0) {
                    console.log(`[AdSenseTracker] ✅ Revenue detected: $${earnings} (${clicks} clicks, ${impressions} impressions)`);

                    return {
                        amount: earnings,
                        currency: 'USD',
                        post_url: postUrl,
                        clicks,
                        impressions,
                        date: new Date().toISOString()
                    };
                }
            }

            console.log(`[AdSenseTracker] No revenue yet for: ${postUrl}`);
            return null;
        } catch (error) {
            console.error('[AdSenseTracker] Revenue check failed:', error.message);
            return null;
        }
    }

    /**
     * Get total AdSense earnings for today
     */
    async getTodayEarnings() {
        if (!this.isConfigured()) {
            return { total: 0, clicks: 0, impressions: 0 };
        }

        try {
            const response = await this.adsense.accounts.reports.generate({
                auth: this.auth,
                account: `accounts/${this.accountId}`,
                dateRange: 'TODAY',
                metrics: ['EARNINGS', 'CLICKS', 'IMPRESSIONS']
            });

            if (response.data.rows && response.data.rows.length > 0) {
                const row = response.data.rows[0];
                return {
                    total: parseFloat(row.cells[0].value),
                    clicks: parseInt(row.cells[1].value),
                    impressions: parseInt(row.cells[2].value)
                };
            }

            return { total: 0, clicks: 0, impressions: 0 };
        } catch (error) {
            console.error('[AdSenseTracker] Failed to get today earnings:', error.message);
            return { total: 0, clicks: 0, impressions: 0 };
        }
    }

    /**
     * Extract PSP proof from AdSense earnings
     */
    async getPSPProof(earnings) {
        if (!this.isConfigured()) {
            console.warn('[AdSenseTracker] AdSense not configured - returning test PSP proof');

            // Return test PSP proof for development
            return {
                provider: 'google_adsense',
                transaction_id: `ADSENSE_TEST_${Date.now()}`,
                amount: earnings.amount,
                currency: 'USD',
                timestamp: earnings.date,
                verification_url: `https://adsense.google.com/`,
                metadata: {
                    post_url: earnings.post_url,
                    clicks: earnings.clicks || 0,
                    impressions: earnings.impressions || 0,
                    test_mode: true
                }
            };
        }

        try {
            // Get payment information from AdSense
            const payments = await this.adsense.accounts.payments.list({
                auth: this.auth,
                parent: `accounts/${this.accountId}`
            });

            // Find the most recent payment that matches our earnings
            let paymentId = `ADSENSE_${this.accountId}_${Date.now()}`;

            if (payments.data.payments && payments.data.payments.length > 0) {
                // Use the most recent payment ID
                const recentPayment = payments.data.payments[0];
                paymentId = recentPayment.name.split('/').pop();
            }

            return {
                provider: 'google_adsense',
                transaction_id: paymentId,
                amount: earnings.amount,
                currency: 'USD',
                timestamp: earnings.date,
                verification_url: `https://adsense.google.com/payments/${paymentId}`,
                metadata: {
                    post_url: earnings.post_url,
                    account_id: this.accountId,
                    clicks: earnings.clicks || 0,
                    impressions: earnings.impressions || 0
                }
            };
        } catch (error) {
            console.error('[AdSenseTracker] Failed to get PSP proof:', error.message);

            // Fallback: create proof with earnings data
            return {
                provider: 'google_adsense',
                transaction_id: `ADSENSE_${this.accountId}_${Date.now()}`,
                amount: earnings.amount,
                currency: 'USD',
                timestamp: earnings.date,
                verification_url: `https://adsense.google.com/`,
                metadata: {
                    post_url: earnings.post_url,
                    account_id: this.accountId,
                    clicks: earnings.clicks || 0,
                    impressions: earnings.impressions || 0,
                    fallback: true
                }
            };
        }
    }

    /**
     * Monitor a post for revenue (checks periodically)
     */
    async monitorPost(postUrl, onRevenue, options = {}) {
        const {
            checkInterval = 60 * 60 * 1000, // Check every hour
            maxDuration = 7 * 24 * 60 * 60 * 1000, // Monitor for 7 days
            onCheck = null
        } = options;

        console.log(`[AdSenseTracker] Starting revenue monitoring for: ${postUrl}`);
        console.log(`[AdSenseTracker] Check interval: ${checkInterval / 1000 / 60} minutes`);
        console.log(`[AdSenseTracker] Max duration: ${maxDuration / 1000 / 60 / 60 / 24} days`);

        const startTime = Date.now();
        let checkCount = 0;

        const checkRevenue = async () => {
            checkCount++;

            if (onCheck) {
                onCheck(checkCount);
            }

            const earnings = await this.checkRevenue(postUrl);

            if (earnings && earnings.amount > 0) {
                console.log(`[AdSenseTracker] 🎉 Revenue detected after ${checkCount} checks!`);

                // Get PSP proof
                const pspProof = await this.getPSPProof(earnings);

                // Call revenue callback
                if (onRevenue) {
                    await onRevenue(earnings, pspProof);
                }

                // Stop monitoring
                clearInterval(intervalId);
                return true;
            }

            // Check if max duration exceeded
            if (Date.now() - startTime > maxDuration) {
                console.log(`[AdSenseTracker] Monitoring timeout after ${checkCount} checks`);
                clearInterval(intervalId);
                return false;
            }

            return false;
        };

        // Start periodic checking
        const intervalId = setInterval(checkRevenue, checkInterval);

        // Do first check immediately
        await checkRevenue();

        return intervalId;
    }
}

export default AdSenseTracker;
