class MetricsCollector {
  constructor() {
    this.requests = [];
    this.responses = new Map();
    this.modelCounts = {};
    this.errorCount = 0;
    this.successCount = 0;
    this.totalDuration = 0;
    this.startTime = Date.now();
    this.maxStoredRequests = 100; // Keep last 100 requests
  }

  recordRequest(data) {
    const request = {
      ...data,
      timestamp: new Date().toISOString()
    };

    this.requests.push(request);

    // Increment model counter
    if (data.model) {
      this.modelCounts[data.model] = (this.modelCounts[data.model] || 0) + 1;
    }

    // Trim old requests
    if (this.requests.length > this.maxStoredRequests) {
      this.requests = this.requests.slice(-this.maxStoredRequests);
    }
  }

  recordResponse(data) {
    this.responses.set(data.id, data);

    if (data.status === 'success') {
      this.successCount++;
    } else {
      this.errorCount++;
    }

    if (data.duration) {
      this.totalDuration += data.duration;
    }

    // Clean up old responses
    if (this.responses.size > this.maxStoredRequests) {
      const oldestKey = this.responses.keys().next().value;
      this.responses.delete(oldestKey);
    }
  }

  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const totalRequests = this.successCount + this.errorCount;
    const avgDuration = totalRequests > 0 ? Math.round(this.totalDuration / totalRequests) : 0;

    return {
      uptime,
      totalRequests,
      successCount: this.successCount,
      errorCount: this.errorCount,
      successRate: totalRequests > 0 ? (this.successCount / totalRequests * 100).toFixed(1) : '0',
      avgResponseTime: avgDuration,
      modelUsage: this.modelCounts,
      recentRequests: this.requests.slice(-20).reverse(), // Last 20 requests
      hourlyCounts: this.getHourlyStats()
    };
  }

  getSummary() {
    const totalRequests = this.successCount + this.errorCount;
    return {
      total: totalRequests,
      success: this.successCount,
      errors: this.errorCount,
      models: Object.keys(this.modelCounts).length
    };
  }

  getHourlyStats() {
    const hourly = {};
    const now = new Date();

    // Initialize last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now - i * 60 * 60 * 1000);
      const key = hour.toISOString().substr(0, 13); // YYYY-MM-DDTHH
      hourly[key] = 0;
    }

    // Count requests per hour
    this.requests.forEach(req => {
      const hour = req.timestamp.substr(0, 13);
      if (hourly.hasOwnProperty(hour)) {
        hourly[hour]++;
      }
    });

    // Convert to array for charting
    return Object.entries(hourly).map(([hour, count]) => ({
      hour: hour.substr(11, 2) + ':00',
      count
    }));
  }

  reset() {
    this.requests = [];
    this.responses.clear();
    this.modelCounts = {};
    this.errorCount = 0;
    this.successCount = 0;
    this.totalDuration = 0;
  }
}

module.exports = { MetricsCollector };