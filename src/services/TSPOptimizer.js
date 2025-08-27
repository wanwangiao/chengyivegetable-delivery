/**
 * TSP (旅行商問題) 路線優化服務
 * 提供多種演算法來優化配送路線
 */

class TSPOptimizer {
  constructor() {
    this.maxIterations = 1000;
    this.coolingRate = 0.003; // 模擬退火降溫速率
  }

  /**
   * 計算兩點間的直線距離 (公里)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 計算道路距離 (考慮實際道路情況)
   * @param {number} lat1 
   * @param {number} lng1 
   * @param {number} lat2 
   * @param {number} lng2 
   * @returns {number} 預估道路距離 (公里)
   */
  calculateRoadDistance(lat1, lng1, lat2, lng2) {
    const directDistance = this.calculateDistance(lat1, lng1, lat2, lng2);
    
    // 台灣都市地區道路修正係數
    let roadFactor = 1.3; // 預設1.3倍
    
    // 根據距離調整係數 (長距離通常道路係數較小)
    if (directDistance > 10) {
      roadFactor = 1.2; // 長距離較直
    } else if (directDistance > 5) {
      roadFactor = 1.25; // 中距離
    } else if (directDistance < 1) {
      roadFactor = 1.4; // 短距離市區較彎曲
    }
    
    return Math.round(directDistance * roadFactor * 100) / 100;
  }

  /**
   * 計算預估行駛時間 (分鐘)
   * @param {number} distance 距離 (公里)
   * @returns {number} 預估時間 (分鐘)
   */
  calculateTravelTime(distance) {
    // 台灣都市配送平均速度考量
    let avgSpeed = 25; // km/h (包含紅綠燈、停車等)
    
    // 根據距離調整平均速度
    if (distance > 10) {
      avgSpeed = 35; // 長距離可能有快速道路
    } else if (distance < 2) {
      avgSpeed = 20; // 短距離多市區道路
    }
    
    return Math.round(distance / avgSpeed * 60); // 轉換為分鐘
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 計算路線總距離
   * @param {Array} route - 路線順序 (訂單陣列)
   * @param {Object} depot - 起點/終點 (倉庫位置)
   */
  calculateRouteDistance(route, depot = null) {
    if (!route || route.length === 0) return 0;
    
    let totalDistance = 0;
    let currentPoint = depot || route[0];

    // 從起點到第一個訂單
    if (depot && route.length > 0) {
      totalDistance += this.calculateRoadDistance(
        currentPoint.lat, currentPoint.lng,
        route[0].lat, route[0].lng
      );
      currentPoint = route[0];
    }

    // 訂單間的距離
    for (let i = 1; i < route.length; i++) {
      totalDistance += this.calculateRoadDistance(
        currentPoint.lat, currentPoint.lng,
        route[i].lat, route[i].lng
      );
      currentPoint = route[i];
    }

    // 回到起點
    if (depot && route.length > 0) {
      totalDistance += this.calculateRoadDistance(
        currentPoint.lat, currentPoint.lng,
        depot.lat, depot.lng
      );
    }

    return totalDistance;
  }

  /**
   * 最近鄰居演算法 (快速但非最佳解)
   * @param {Array} orders - 訂單列表
   * @param {Object} depot - 起點位置
   */
  nearestNeighbor(orders, depot = null) {
    if (!orders || orders.length === 0) {
      return { route: [], totalDistance: 0, method: 'nearest_neighbor' };
    }

    console.log(`🎯 執行最近鄰居演算法: ${orders.length} 個訂單`);

    const unvisited = [...orders];
    const route = [];
    let currentPoint = depot || orders[0];

    // 如果有起點且不是訂單中的一個，從起點開始
    if (depot) {
      // 不需要將起點加入路線
    } else {
      // 沒有起點，從第一個訂單開始
      route.push(unvisited.shift());
      currentPoint = route[0];
    }

    // 依次選擇最近的未訪問訂單
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      unvisited.forEach((order, index) => {
        const distance = this.calculateDistance(
          currentPoint.lat, currentPoint.lng,
          order.lat, order.lng
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      const nextOrder = unvisited.splice(nearestIndex, 1)[0];
      route.push(nextOrder);
      currentPoint = nextOrder;
    }

    const totalDistance = this.calculateRouteDistance(route, depot);
    
    console.log(`✅ 最近鄰居完成: 總距離 ${totalDistance.toFixed(2)}km`);

    return {
      route,
      totalDistance,
      method: 'nearest_neighbor'
    };
  }

  /**
   * 2-opt 優化演算法
   * 改善現有路線的局部最佳化
   */
  twoOptImprove(route, depot = null) {
    if (!route || route.length < 4) {
      return {
        route: [...route],
        totalDistance: this.calculateRouteDistance(route, depot),
        method: '2-opt',
        improvements: 0
      };
    }

    console.log(`🔧 執行 2-opt 優化: ${route.length} 個點`);

    let currentRoute = [...route];
    let bestDistance = this.calculateRouteDistance(currentRoute, depot);
    let improvements = 0;
    let hasImprovement = true;

    while (hasImprovement && improvements < this.maxIterations) {
      hasImprovement = false;

      for (let i = 1; i < currentRoute.length - 2; i++) {
        for (let j = i + 1; j < currentRoute.length; j++) {
          if (j - i === 1) continue; // 跳過相鄰的邊

          // 創建新路線 (2-opt swap)
          const newRoute = this.twoOptSwap(currentRoute, i, j);
          const newDistance = this.calculateRouteDistance(newRoute, depot);

          if (newDistance < bestDistance) {
            currentRoute = newRoute;
            bestDistance = newDistance;
            hasImprovement = true;
            improvements++;
          }
        }
      }
    }

    console.log(`✅ 2-opt 完成: ${improvements} 次改善, 總距離 ${bestDistance.toFixed(2)}km`);

    return {
      route: currentRoute,
      totalDistance: bestDistance,
      method: '2-opt',
      improvements
    };
  }

  /**
   * 執行 2-opt 交換
   */
  twoOptSwap(route, i, j) {
    const newRoute = [...route];
    
    // 反轉 i 到 j 之間的順序
    while (i < j) {
      [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
      i++;
      j--;
    }
    
    return newRoute;
  }

  /**
   * 模擬退火演算法
   * 能跳出局部最佳解，尋找更好的全域解
   */
  simulatedAnnealing(orders, depot = null, initialTemperature = 10000) {
    if (!orders || orders.length === 0) {
      return { route: [], totalDistance: 0, method: 'simulated_annealing' };
    }

    console.log(`🌡️ 執行模擬退火演算法: ${orders.length} 個訂單`);

    // 使用最近鄰居作為初始解
    let currentSolution = this.nearestNeighbor(orders, depot);
    let currentRoute = [...currentSolution.route];
    let currentDistance = currentSolution.totalDistance;

    let bestRoute = [...currentRoute];
    let bestDistance = currentDistance;

    let temperature = initialTemperature;
    let iteration = 0;
    let acceptedMoves = 0;

    while (temperature > 1 && iteration < this.maxIterations) {
      // 生成鄰近解 (隨機交換兩個訂單位置)
      const newRoute = this.generateNeighborSolution(currentRoute);
      const newDistance = this.calculateRouteDistance(newRoute, depot);

      // 計算能量差
      const deltaE = newDistance - currentDistance;

      // 接受新解的條件
      if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temperature)) {
        currentRoute = newRoute;
        currentDistance = newDistance;
        acceptedMoves++;

        // 更新最佳解
        if (newDistance < bestDistance) {
          bestRoute = [...newRoute];
          bestDistance = newDistance;
        }
      }

      // 降溫
      temperature *= (1 - this.coolingRate);
      iteration++;
    }

    console.log(`✅ 模擬退火完成: ${iteration} 次迭代, ${acceptedMoves} 次接受, 最佳距離 ${bestDistance.toFixed(2)}km`);

    return {
      route: bestRoute,
      totalDistance: bestDistance,
      method: 'simulated_annealing',
      iterations: iteration,
      acceptedMoves
    };
  }

  /**
   * 生成鄰近解 (隨機交換)
   */
  generateNeighborSolution(route) {
    if (route.length < 2) return [...route];

    const newRoute = [...route];
    const i = Math.floor(Math.random() * route.length);
    const j = Math.floor(Math.random() * route.length);

    // 交換兩個位置
    [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];

    return newRoute;
  }

  /**
   * 遺傳演算法
   * 適合較大規模的問題
   */
  geneticAlgorithm(orders, depot = null, populationSize = 50, generations = 200) {
    if (!orders || orders.length === 0) {
      return { route: [], totalDistance: 0, method: 'genetic_algorithm' };
    }

    console.log(`🧬 執行遺傳演算法: ${orders.length} 個訂單, 族群大小 ${populationSize}`);

    // 初始化族群
    let population = this.initializePopulation(orders, populationSize);
    let bestSolution = this.evaluatePopulation(population, depot)[0];

    for (let generation = 0; generation < generations; generation++) {
      // 評估適應度
      const evaluatedPopulation = this.evaluatePopulation(population, depot);
      
      // 更新最佳解
      if (evaluatedPopulation[0].fitness < bestSolution.fitness) {
        bestSolution = { ...evaluatedPopulation[0] };
      }

      // 選擇、交叉、突變
      population = this.evolvePopulation(evaluatedPopulation);

      if (generation % 50 === 0) {
        console.log(`  第 ${generation} 代: 最佳距離 ${bestSolution.fitness.toFixed(2)}km`);
      }
    }

    console.log(`✅ 遺傳演算法完成: ${generations} 代, 最佳距離 ${bestSolution.fitness.toFixed(2)}km`);

    return {
      route: bestSolution.route,
      totalDistance: bestSolution.fitness,
      method: 'genetic_algorithm',
      generations
    };
  }

  /**
   * 初始化族群
   */
  initializePopulation(orders, populationSize) {
    const population = [];

    for (let i = 0; i < populationSize; i++) {
      const route = [...orders];
      // 隨機打亂順序
      for (let j = route.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [route[j], route[k]] = [route[k], route[j]];
      }
      population.push({ route });
    }

    return population;
  }

  /**
   * 評估族群適應度
   */
  evaluatePopulation(population, depot) {
    return population
      .map(individual => ({
        ...individual,
        fitness: this.calculateRouteDistance(individual.route, depot)
      }))
      .sort((a, b) => a.fitness - b.fitness);
  }

  /**
   * 族群演化
   */
  evolvePopulation(evaluatedPopulation) {
    const populationSize = evaluatedPopulation.length;
    const eliteSize = Math.floor(populationSize * 0.2); // 保留20%精英
    const newPopulation = [];

    // 精英保留
    for (let i = 0; i < eliteSize; i++) {
      newPopulation.push({ route: [...evaluatedPopulation[i].route] });
    }

    // 生成新個體
    while (newPopulation.length < populationSize) {
      const parent1 = this.tournamentSelection(evaluatedPopulation);
      const parent2 = this.tournamentSelection(evaluatedPopulation);
      
      let child = this.crossover(parent1.route, parent2.route);
      child = this.mutate(child);
      
      newPopulation.push({ route: child });
    }

    return newPopulation;
  }

  /**
   * 錦標賽選擇
   */
  tournamentSelection(population, tournamentSize = 3) {
    const tournament = [];
    
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }
    
    return tournament.reduce((best, current) => 
      current.fitness < best.fitness ? current : best
    );
  }

  /**
   * 順序交叉 (Order Crossover)
   */
  crossover(parent1, parent2) {
    const length = parent1.length;
    const start = Math.floor(Math.random() * length);
    const end = Math.floor(Math.random() * length);
    
    const [startPos, endPos] = start < end ? [start, end] : [end, start];
    
    // 從 parent1 複製中間段
    const child = new Array(length);
    for (let i = startPos; i <= endPos; i++) {
      child[i] = parent1[i];
    }
    
    // 從 parent2 按順序填充剩餘位置
    let currentPos = 0;
    for (let i = 0; i < length; i++) {
      if (currentPos === startPos) {
        currentPos = endPos + 1;
      }
      
      if (currentPos >= length) break;
      
      const item = parent2[i];
      if (!child.includes(item)) {
        child[currentPos] = item;
        currentPos++;
      }
    }
    
    return child.filter(item => item !== undefined);
  }

  /**
   * 突變 (交換突變)
   */
  mutate(route, mutationRate = 0.1) {
    if (Math.random() < mutationRate && route.length > 1) {
      const newRoute = [...route];
      const i = Math.floor(Math.random() * route.length);
      const j = Math.floor(Math.random() * route.length);
      [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
      return newRoute;
    }
    return route;
  }

  /**
   * 綜合優化方法
   * 結合多種演算法獲得最佳結果
   */
  optimizeRoute(orders, depot = null, method = 'hybrid') {
    if (!orders || orders.length === 0) {
      return { route: [], totalDistance: 0, method: 'none' };
    }

    console.log(`🚀 開始路線優化: ${orders.length} 個訂單, 方法: ${method}`);

    let result;

    switch (method) {
      case 'nearest':
        result = this.nearestNeighbor(orders, depot);
        break;
        
      case '2opt':
        const nnResult = this.nearestNeighbor(orders, depot);
        result = this.twoOptImprove(nnResult.route, depot);
        break;
        
      case 'annealing':
        result = this.simulatedAnnealing(orders, depot);
        break;
        
      case 'genetic':
        result = this.geneticAlgorithm(orders, depot);
        break;
        
      case 'hybrid':
      default:
        // 混合方法：根據問題大小選擇最適合的演算法
        if (orders.length <= 10) {
          // 小規模：最近鄰居 + 2-opt
          const nnResult = this.nearestNeighbor(orders, depot);
          result = this.twoOptImprove(nnResult.route, depot);
        } else if (orders.length <= 20) {
          // 中規模：模擬退火
          result = this.simulatedAnnealing(orders, depot);
        } else {
          // 大規模：遺傳演算法
          result = this.geneticAlgorithm(orders, depot);
        }
    }

    // 添加詳細的路線資訊
    result.routeDetails = this.generateRouteDetails(result.route, depot);
    
    console.log(`✅ 路線優化完成: ${result.method}, 總距離 ${result.totalDistance.toFixed(2)}km`);

    return result;
  }

  /**
   * 生成詳細的路線資訊
   */
  generateRouteDetails(route, depot) {
    const details = [];
    let currentPoint = depot;
    let cumulativeDistance = 0;

    if (depot) {
      details.push({
        type: 'depot',
        location: depot,
        distance: 0,
        cumulativeDistance: 0,
        description: '配送起點'
      });
      currentPoint = depot;
    }

    route.forEach((order, index) => {
      const distance = currentPoint ? 
        this.calculateDistance(currentPoint.lat, currentPoint.lng, order.lat, order.lng) : 0;
      
      cumulativeDistance += distance;

      details.push({
        type: 'delivery',
        order: order,
        location: { lat: order.lat, lng: order.lng },
        distance: distance,
        cumulativeDistance: cumulativeDistance,
        step: index + 1,
        description: `配送到: ${order.contact_name} (${order.address})`
      });

      currentPoint = order;
    });

    if (depot && route.length > 0) {
      const returnDistance = this.calculateDistance(
        currentPoint.lat, currentPoint.lng,
        depot.lat, depot.lng
      );
      
      cumulativeDistance += returnDistance;

      details.push({
        type: 'return',
        location: depot,
        distance: returnDistance,
        cumulativeDistance: cumulativeDistance,
        description: '返回起點'
      });
    }

    return details;
  }
}

module.exports = TSPOptimizer;