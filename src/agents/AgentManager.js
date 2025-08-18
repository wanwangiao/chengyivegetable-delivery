/**
 * Agent 管理器
 * 負責管理所有 Sub-Agent 的生命週期和訊息路由
 */
class AgentManager {
  constructor() {
    this.agents = new Map();
    this.messageQueue = [];
    this.isProcessingMessages = false;
    this.heartbeatInterval = null;
    this.config = {
      heartbeatInterval: 30000, // 30秒
      messageTimeout: 10000,    // 10秒
      maxRetries: 3
    };
    
    console.log('🎛️ AgentManager 已初始化');
  }

  /**
   * 註冊 Agent
   */
  registerAgent(agent) {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent ${agent.name} 已經註冊`);
    }
    
    agent.agentManager = this;
    this.agents.set(agent.name, agent);
    console.log(`📝 Agent ${agent.name} 已註冊`);
    
    return agent;
  }

  /**
   * 移除 Agent
   */
  unregisterAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (agent) {
      agent.stop();
      agent.agentManager = null;
      this.agents.delete(agentName);
      console.log(`🗑️ Agent ${agentName} 已移除`);
    }
  }

  /**
   * 啟動所有 Agent
   */
  async startAllAgents() {
    console.log('🚀 啟動所有 Agent...');
    
    const startPromises = Array.from(this.agents.values()).map(agent => 
      agent.start().catch(error => {
        console.error(`❌ 啟動 ${agent.name} 失敗:`, error);
        return { agent: agent.name, error };
      })
    );
    
    const results = await Promise.allSettled(startPromises);
    
    // 啟動心跳檢查
    this.startHeartbeat();
    
    // 啟動訊息處理
    this.startMessageProcessing();
    
    console.log('✅ Agent 啟動完成');
    return results;
  }

  /**
   * 停止所有 Agent
   */
  async stopAllAgents() {
    console.log('🛑 停止所有 Agent...');
    
    // 停止心跳檢查
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // 停止訊息處理
    this.isProcessingMessages = false;
    
    const stopPromises = Array.from(this.agents.values()).map(agent => 
      agent.stop().catch(error => {
        console.error(`❌ 停止 ${agent.name} 失敗:`, error);
        return { agent: agent.name, error };
      })
    );
    
    await Promise.allSettled(stopPromises);
    console.log('✅ 所有 Agent 已停止');
  }

  /**
   * 獲取特定 Agent
   */
  getAgent(agentName) {
    return this.agents.get(agentName);
  }

  /**
   * 獲取所有 Agent 狀態
   */
  getAllAgentStatus() {
    const status = {};
    this.agents.forEach((agent, name) => {
      status[name] = agent.getStatus();
    });
    return status;
  }

  /**
   * 路由訊息到目標 Agent
   */
  async routeMessage(fromAgent, targetAgent, message) {
    console.log(`📬 路由訊息: ${fromAgent} → ${targetAgent}`);
    
    const target = this.agents.get(targetAgent);
    if (!target) {
      throw new Error(`目標 Agent ${targetAgent} 不存在`);
    }
    
    if (!target.isActive) {
      throw new Error(`目標 Agent ${targetAgent} 未啟動`);
    }
    
    try {
      const response = await Promise.race([
        target.receiveMessage(fromAgent, message),
        this.createTimeoutPromise(this.config.messageTimeout)
      ]);
      
      console.log(`✅ 訊息路由成功: ${fromAgent} → ${targetAgent}`);
      return response;
      
    } catch (error) {
      console.error(`❌ 訊息路由失敗: ${fromAgent} → ${targetAgent}`, error);
      throw error;
    }
  }

  /**
   * 廣播訊息給所有 Agent
   */
  async broadcastMessage(fromAgent, message, excludeSelf = true) {
    console.log(`📢 ${fromAgent} 廣播訊息: ${message.type}`);
    
    const promises = [];
    this.agents.forEach((agent, name) => {
      if (excludeSelf && name === fromAgent) return;
      if (!agent.isActive) return;
      
      promises.push(
        this.routeMessage(fromAgent, name, message)
          .catch(error => ({ agent: name, error }))
      );
    });
    
    return await Promise.allSettled(promises);
  }

  /**
   * 執行分散式任務
   */
  async executeDistributedTask(taskName, taskData, targetAgents = null) {
    const agents = targetAgents 
      ? targetAgents.map(name => this.agents.get(name)).filter(Boolean)
      : Array.from(this.agents.values()).filter(agent => agent.isActive);
    
    console.log(`⚙️ 執行分散式任務: ${taskName} (${agents.length} 個 Agent)`);
    
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: taskName,
      data: taskData,
      createdAt: new Date()
    };
    
    const results = await Promise.allSettled(
      agents.map(agent => 
        agent.executeTask(task).catch(error => ({
          agent: agent.name,
          error: error.message
        }))
      )
    );
    
    return {
      taskId: task.id,
      results: results.map((result, index) => ({
        agent: agents[index].name,
        status: result.status,
        value: result.value,
        reason: result.reason
      }))
    };
  }

  /**
   * Agent 狀態通知
   */
  notifyAgentStatus(agentName, status) {
    console.log(`📊 Agent 狀態更新: ${agentName} - ${status}`);
    
    // 可以在這裡添加狀態變更的處理邏輯
    // 例如：記錄到資料庫、發送通知等
  }

  /**
   * Agent 錯誤通知
   */
  notifyAgentError(agentName, error) {
    console.error(`🚨 Agent 錯誤通知: ${agentName}`, error);
    
    // 可以在這裡添加錯誤處理邏輯
    // 例如：自動重啟、發送警報等
  }

  /**
   * 啟動心跳檢查
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.checkAgentHealth();
    }, this.config.heartbeatInterval);
    
    console.log(`💓 心跳檢查已啟動 (間隔: ${this.config.heartbeatInterval}ms)`);
  }

  /**
   * 檢查 Agent 健康狀態
   */
  checkAgentHealth() {
    const now = new Date();
    
    this.agents.forEach((agent, name) => {
      if (!agent.isActive) return;
      
      const timeSinceActivity = now - (agent.lastActivity || agent.startTime);
      const maxIdleTime = this.config.heartbeatInterval * 3; // 3倍心跳間隔
      
      if (timeSinceActivity > maxIdleTime) {
        console.warn(`⚠️ Agent ${name} 可能無回應 (閒置: ${timeSinceActivity}ms)`);
        
        // 可以在這裡實作自動重啟邏輯
        // agent.restart();
      }
    });
  }

  /**
   * 啟動訊息處理
   */
  startMessageProcessing() {
    this.isProcessingMessages = true;
    // 如果有訊息佇列處理需求，可以在這裡實作
  }

  /**
   * 建立超時 Promise
   */
  createTimeoutPromise(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`操作超時 (${timeout}ms)`));
      }, timeout);
    });
  }

  /**
   * 取得系統統計資訊
   */
  getSystemStats() {
    const stats = {
      totalAgents: this.agents.size,
      activeAgents: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalErrors: 0
    };
    
    this.agents.forEach(agent => {
      const status = agent.getStatus();
      if (status.isActive) stats.activeAgents++;
      stats.totalTasks += status.taskCount;
      stats.completedTasks += status.completedTasks;
      stats.failedTasks += status.failedTasks;
      stats.totalErrors += status.errorCount;
    });
    
    return {
      ...stats,
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }
}

module.exports = AgentManager;