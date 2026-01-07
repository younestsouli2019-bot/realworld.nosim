import crypto from 'crypto';

export class IntelligentMissionConsolidator {
  /**
   * AI-powered mission consolidation system that:
   * 1. Detects overlapping missions by objective similarity
   * 2. Identifies duplicate or fragmented resources
   * 3. Recommends optimal merge strategies
   * 4. Executes consolidation with progress preservation
   */
  constructor(missionsData) {
    this.missions = missionsData;
    this.clusters = [];
    this.similarityThreshold = 0.65; // 65% similarity triggers merge recommendation

    // Pre-computed keyword extraction patterns
    this.objectivePatterns = {
      'paypal': ['paypal', 'payout', 'transfer', 'withdrawal', 'api', 'webhook'],
      'deployment': ['deploy', 'server', 'vps', 'github', 'docker', 'container'],
      'marketing': ['list', 'etsy', 'gumroad', 'amazon', 'sales', 'revenue'],
      'operations': ['monitor', 'audit', 'daemon', 'system', 'infrastructure'],
      'financial': ['revenue', 'payment', 'gateway', 'bank', 'transaction']
    };
  }

  extractMissionFingerprint(mission) {
    /* Create a semantic fingerprint of mission for comparison */
    const fingerprint = {
      id: mission.id || '',
      type: mission.type || '',
      priority: mission.priority || '',
      objectiveKeywords: this._extractKeywords(mission),
      assignedAgents: new Set(Array.isArray(this._parseJsonSafe(mission.assigned_agent_ids || '[]')) ? this._parseJsonSafe(mission.assigned_agent_ids || '[]') : []),
      resourceSignature: this._extractResourceSignature(mission),
      progressState: mission.progress_data || {},
      createdDate: mission.created_date || '',
      status: mission.status || ''
    };

    // Parse mission parameters if they exist
    if (mission.mission_parameters) {
      try {
        const params = this._parseJsonSafe(mission.mission_parameters);
        fingerprint.parameters = params;
        fingerprint.objective = params.objective || params.description || mission.title || '';
      } catch (e) {
        fingerprint.objective = mission.title || '';
      }
    } else {
      fingerprint.objective = mission.title || '';
    }

    return fingerprint;
  }

  _extractKeywords(mission) {
    /* Extract keywords from title and parameters */
    const keywords = new Set();

    // From title
    const title = (mission.title || '').toLowerCase();
    const titleMatches = title.match(/\b[a-z]{4,}\b/g) || [];
    titleMatches.forEach(k => keywords.add(k));

    // From mission parameters
    if (mission.mission_parameters) {
      try {
        const params = this._parseJsonSafe(mission.mission_parameters);
        const paramStr = JSON.stringify(params).toLowerCase();
        const paramMatches = paramStr.match(/\b[a-z]{4,}\b/g) || [];
        paramMatches.forEach(k => keywords.add(k));
      } catch (e) {
        // ignore
      }
    }

    // Remove common stop words
    const stopWords = new Set(['with', 'that', 'this', 'have', 'from', 'they', 'which', 'their']);
    for (const stopWord of stopWords) {
      keywords.delete(stopWord);
    }

    return keywords;
  }

  _extractResourceSignature(mission) {
    /* Create hash signature of resources used by mission */
    const signatureParts = [];

    // Agents assigned
    const parsedAgents = this._parseJsonSafe(mission.assigned_agent_ids || '[]');
    const agents = Array.isArray(parsedAgents) ? parsedAgents : [];
    agents.sort();
    signatureParts.push(`agents:${JSON.stringify(agents)}`);

    // GitHub repos, APIs, platforms mentioned
    if (mission.mission_parameters) {
      try {
        const params = this._parseJsonSafe(mission.mission_parameters);
        if (params && typeof params === 'object') {
          const paramStr = JSON.stringify(params).toLowerCase();
          if (paramStr.includes('github')) signatureParts.push("resource:github");
          if (paramStr.includes('paypal')) signatureParts.push("resource:paypal");
          if (paramStr.includes('stripe')) signatureParts.push("resource:stripe");
          if (['aws', 'azure', 'gcp'].some(cloud => paramStr.includes(cloud))) signatureParts.push("resource:cloud");
          if (paramStr.includes('docker') || paramStr.includes('container')) signatureParts.push("resource:docker");
        }
      } catch (e) {
        // ignore
      }
    }

    return crypto.createHash('md5').update(signatureParts.join('|')).digest('hex').substring(0, 12);
  }

  calculateSimilarity(mission1, mission2) {
    /* Calculate similarity score between two missions (0-1) */
    const fp1 = this.extractMissionFingerprint(mission1);
    const fp2 = this.extractMissionFingerprint(mission2);

    const scores = [];

    // 1. Type and priority match (30% weight)
    if (fp1.type === fp2.type) scores.push(0.3);
    else scores.push(0.0);

    if (fp1.priority === fp2.priority) scores.push(0.2);
    else scores.push(0.0);

    // 2. Keyword overlap (25% weight)
    const keywords1 = fp1.objectiveKeywords;
    const keywords2 = fp2.objectiveKeywords;
    
    // Intersection
    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    // Union
    const union = new Set([...keywords1, ...keywords2]);
    
    const keywordScore = union.size > 0 ? intersection.size / union.size : 0;
    scores.push(keywordScore * 0.25);

    // 3. Resource signature match (15% weight)
    if (fp1.resourceSignature === fp2.resourceSignature) scores.push(0.15);
    else scores.push(0.0);

    // 4. Agent overlap (10% weight)
    const agents1 = fp1.assignedAgents;
    const agents2 = fp2.assignedAgents;
    
    const agentIntersection = new Set([...agents1].filter(x => agents2.has(x)));
    const agentUnion = new Set([...agents1, ...agents2]);
    
    const agentScore = agentUnion.size > 0 ? agentIntersection.size / agentUnion.size : 0;
    scores.push(agentScore * 0.1);

    const total = scores.reduce((a, b) => a + b, 0);
    // console.log(`Similarity ${mission1.id} vs ${mission2.id}: ${total.toFixed(3)} (Type/Pri: ${(scores[0]+scores[1]).toFixed(2)}, KW: ${scores[2].toFixed(2)}, Res: ${scores[3].toFixed(2)}, Agent: ${scores[4].toFixed(2)})`);
    return total;
  }

  detectClusters() {
    /* Find clusters of similar missions */
    const fingerprints = this.missions.map(m => this.extractMissionFingerprint(m));
    const visited = new Set();
    const clusters = [];

    for (let i = 0; i < fingerprints.length; i++) {
      const fp1 = fingerprints[i];
      if (visited.has(fp1.id)) continue;

      const clusterMissions = [fp1.id];
      visited.add(fp1.id);

      for (let j = 0; j < fingerprints.length; j++) {
        if (i === j) continue;
        const fp2 = fingerprints[j];
        if (visited.has(fp2.id)) continue;

        const mission1 = this.missions[i];
        const mission2 = this.missions[j];
        const similarity = this.calculateSimilarity(mission1, mission2);

        if (similarity >= this.similarityThreshold) {
          clusterMissions.push(fp2.id);
          visited.add(fp2.id);
        }
      }

      if (clusterMissions.length > 1) {
        // Analyze the cluster
        const clusterMissionsData = this.missions.filter(m => clusterMissions.includes(m.id));

        // Determine common characteristics
        const types = clusterMissionsData.map(m => m.type || '');
        const commonType = this._mode(types);

        const priorities = clusterMissionsData.map(m => m.priority || '');
        const commonPriority = this._mode(priorities);

        // Find overlapping agents
        const allAgents = [];
        clusterMissionsData.forEach(m => {
            const parsed = this._parseJsonSafe(m.assigned_agent_ids || '[]');
            const agents = Array.isArray(parsed) ? parsed : [];
            allAgents.push(...agents);
        });
        
        const agentCounts = {};
        allAgents.forEach(a => { agentCounts[a] = (agentCounts[a] || 0) + 1; });
        const overlappingAgents = new Set(Object.keys(agentCounts).filter(a => agentCounts[a] > 1));

        // Extract common keywords
        const allKeywords = new Set();
        clusterMissionsData.forEach(m => {
            const kws = this._extractKeywords(m);
            kws.forEach(k => allKeywords.add(k));
        });

        // Find most representative objective
        const objectives = [];
        clusterMissionsData.forEach(m => {
            const obj = this.extractMissionFingerprint(m).objective;
            if (obj) objectives.push(obj);
        });
        
        const coreObjective = objectives.length > 0 
            ? objectives.reduce((a, b) => a.length > b.length ? a : b) 
            : "Consolidated Mission";

        // Determine merge action
        const statuses = clusterMissionsData.map(m => m.status || '');
        let action = "consolidate";
        if (statuses.includes('deployed') && statuses.includes('in_progress')) {
            action = "redirect";
        } else if (clusterMissions.length > 2) {
            action = "merge";
        }

        clusters.push({
            clusterId: `cluster_${clusters.length + 1}`,
            coreObjective,
            missionIds: clusterMissions,
            commonType,
            commonPriority,
            overlappingAgents,
            sharedKeywords: allKeywords,
            recommendedMergeAction: action,
            confidenceScore: 0.8
        });
      }
    }

    this.clusters = clusters;
    return clusters;
  }

  generateConsolidatedMission(cluster) {
    const clusterMissions = this.missions.filter(m => cluster.missionIds.includes(m.id));
    
    // Find base mission (most advanced status)
    const statusOrder = { 'deployed': 4, 'in_progress': 3, 'active': 2, 'pending': 1, 'completed': 0 };
    const baseMission = clusterMissions.reduce((prev, current) => {
        const prevScore = statusOrder[(prev.status || '').toLowerCase()] || 0;
        const currScore = statusOrder[(current.status || '').toLowerCase()] || 0;
        return currScore > prevScore ? current : prev;
    });

    // Merge agents
    const allAgents = new Set();
    clusterMissions.forEach(m => {
        const parsed = this._parseJsonSafe(m.assigned_agent_ids || '[]');
        const agents = Array.isArray(parsed) ? parsed : [];
        agents.forEach(a => allAgents.add(a));
    });

    // Merge progress data
    const allProgress = [];
    clusterMissions.forEach(m => {
        let progress = m.progress_data || '{}';
        if (typeof progress === 'string') progress = this._parseJsonSafe(progress);
        if (progress && typeof progress === 'object') allProgress.push(progress);
    });

    // Find common parameters
    const commonParams = {};
    const paramKeys = new Set();
    clusterMissions.forEach(m => {
        let params = m.mission_parameters || '{}';
        if (typeof params === 'string') params = this._parseJsonSafe(params);
        if (params && typeof params === 'object') {
            Object.keys(params).forEach(k => paramKeys.add(k));
        }
    });

    for (const key of paramKeys) {
        const values = [];
        for (const m of clusterMissions) {
            let params = m.mission_parameters || '{}';
            if (typeof params === 'string') params = this._parseJsonSafe(params);
            if (params && typeof params === 'object' && key in params) {
                values.push(params[key]);
            }
        }
        if (values.length === clusterMissions.length) {
            if (values.every(v => v === values[0])) {
                commonParams[key] = values[0];
            } else {
                commonParams[key] = values;
            }
        }
    }

    // Consolidated mission object
    return {
        title: `🧩 CONSOLIDATED: ${cluster.coreObjective.substring(0, 50)}...`,
        type: cluster.commonType,
        priority: cluster.commonPriority,
        status: baseMission.status || 'in_progress',
        assigned_agent_ids: JSON.stringify([...allAgents]),
        mission_parameters: JSON.stringify({
            consolidated_from: cluster.missionIds,
            original_objectives: clusterMissions.map(m => m.title || ''),
            consolidation_date: new Date().toISOString(),
            merged_parameters: commonParams,
            core_objective: cluster.coreObjective
        }),
        progress_data: JSON.stringify({
            percentage: this._calculateConsolidatedProgress(allProgress),
            consolidated_from: cluster.missionIds,
            previous_progress: allProgress,
            consolidation_note: `Merged ${clusterMissions.length} similar missions`
        }),
        estimated_duration_hours: this._calculateConsolidatedDuration(clusterMissions),
        actual_duration_hours: "",
        deadline: clusterMissions.map(m => m.deadline || '').sort().reverse()[0] || '', // Max deadline? Or min? Python used max.
        completion_notes: `Auto-consolidated from missions: ${cluster.missionIds.join(', ')}`,
        revenue_generated: clusterMissions.reduce((sum, m) => sum + (parseFloat(m.revenue_generated) || 0), 0),
        id: `consolidated_${crypto.createHash('md5').update(cluster.missionIds.join(',')).digest('hex').substring(0, 8)}`,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        created_by_id: baseMission.created_by_id || '',
        created_by: baseMission.created_by || '',
        is_sample: "false"
    };
  }

  generateConsolidationReport() {
    const clusters = this.detectClusters();
    
    const report = {
        generated_at: new Date().toISOString(),
        total_missions_analyzed: this.missions.length,
        clusters_detected: clusters.length,
        missions_targeted_for_consolidation: clusters.reduce((sum, c) => sum + c.missionIds.length, 0),
        potential_resource_savings: this._estimateResourceSavings(clusters),
        clusters: []
    };

    for (const cluster of clusters) {
        report.clusters.push({
            cluster_id: cluster.clusterId,
            mission_count: cluster.missionIds.length,
            core_objective: cluster.coreObjective,
            recommended_action: cluster.recommendedMergeAction,
            confidence: cluster.confidenceScore,
            missions_involved: cluster.missionIds,
            overlapping_agents: [...cluster.overlappingAgents],
            consolidated_mission: this.generateConsolidatedMission(cluster)
        });
    }

    return report;
  }

  _estimateResourceSavings(clusters) {
    let totalAgentHoursSaved = 0;
    let totalDuplicateEffort = 0;

    for (const cluster of clusters) {
        const clusterMissions = this.missions.filter(m => cluster.missionIds.includes(m.id));
        
        const allAgents = [];
    clusterMissions.forEach(m => {
        const parsed = this._parseJsonSafe(m.assigned_agent_ids || '[]');
        const agents = Array.isArray(parsed) ? parsed : [];
        allAgents.push(...agents);
    });

        const agentCounts = {};
        allAgents.forEach(a => { agentCounts[a] = (agentCounts[a] || 0) + 1; });
        
        const duplicateAgents = Object.values(agentCounts).reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);
        totalAgentHoursSaved += duplicateAgents * 8; // Assume 8h per duplicate

        totalDuplicateEffort += (cluster.missionIds.length - 1) * 4; // 4h per duplicate mission
    }

    const totalHoursSaved = totalAgentHoursSaved + totalDuplicateEffort;
    const totalPossibleHours = this.missions.length * 8;
    const efficiencyGain = totalPossibleHours > 0 ? (totalHoursSaved / totalPossibleHours) * 100 : 0;

    return {
        agent_hours_saved: totalAgentHoursSaved,
        duplicate_effort_hours: totalDuplicateEffort,
        total_hours_saved: totalHoursSaved,
        estimated_efficiency_gain: `${efficiencyGain.toFixed(1)}%`
    };
  }

  _calculateConsolidatedProgress(allProgress) {
    if (!allProgress || allProgress.length === 0) return 0;
    
    const percentages = [];
    for (const p of allProgress) {
        const perc = p.percentage;
        if (typeof perc === 'number') percentages.push(perc);
        else if (typeof perc === 'string' && !isNaN(parseFloat(perc))) percentages.push(parseFloat(perc));
    }
    
    if (percentages.length === 0) return 0;
    return Math.floor(percentages.reduce((a, b) => a + b, 0) / percentages.length);
  }

  _calculateConsolidatedDuration(missions) {
    let totalHours = 0;
    for (const m of missions) {
        const d = parseFloat(m.estimated_duration_hours);
        if (!isNaN(d)) totalHours += d;
    }
    return totalHours > 0 ? String(totalHours) : "";
  }

  _parseJsonSafe(str) {
    if (typeof str !== 'string') return str;
    try {
        return JSON.parse(str);
    } catch (e) {
        return str.startsWith('[') ? [] : {};
    }
  }

  _mode(arr) {
    if (arr.length === 0) return null;
    const counts = {};
    let maxCount = 0;
    let mode = arr[0];
    for (const item of arr) {
        counts[item] = (counts[item] || 0) + 1;
        if (counts[item] > maxCount) {
            maxCount = counts[item];
            mode = item;
        }
    }
    return mode;
  }
}
