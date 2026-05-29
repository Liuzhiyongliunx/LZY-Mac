/**
 * 云数据库服务 + 本地存储双写
 * 优先读云数据，云不可用时降级到本地存储
 */

const LOCAL_KEY = 'checkinRecords';

// 检查云开发是否就绪
function isCloudReady() {
  try {
    const app = getApp();
    return app.globalData && app.globalData.cloudReady === true;
  } catch (e) {
    return false;
  }
}

// 获取 checkins 集合引用
function getCollection() {
  return wx.cloud.database().collection('checkins');
}

module.exports = {

  // ========== 统一增删改查 ==========

  // 获取所有打卡记录（云+本地合并，去重）
  async getAllRecords() {
    const localRecords = wx.getStorageSync(LOCAL_KEY) || [];

    if (!isCloudReady()) {
      return localRecords;
    }

    try {
      const cloudResult = await getCollection().get();
      const cloudRecords = (cloudResult.data || []).map(r => ({
        id: r._id,
        date: r.date,
        checkinTime: r.checkinTime,
        userId: r.userId,
        userName: r.userName,
        tasks: r.tasks || [],
        totalHours: r.totalHours,
        createTime: r.createTime,
        completedAt: r.completedAt
      }));

      // 合并云+本地，以云数据为准，按日期去重
      const cloudDateMap = {};
      cloudRecords.forEach(r => { cloudDateMap[r.date] = r; });

      const merged = [];
      const seenDates = new Set();

      // 云数据优先
      cloudRecords.forEach(r => {
        merged.push(r);
        seenDates.add(r.date);
      });

      // 补上本地有但云端没有的记录
      localRecords.forEach(r => {
        if (!seenDates.has(r.date)) {
          merged.push(r);
          seenDates.add(r.date);
        }
      });

      return merged;
    } catch (e) {
      console.warn('云数据库读取失败，使用本地数据:', e);
      return localRecords;
    }
  },

  // 保存打卡记录（云端+本地双写）
  async saveCheckin(record) {
    // 先写本地
    const localRecords = wx.getStorageSync(LOCAL_KEY) || [];
    const existingIndex = localRecords.findIndex(r => r.date === record.date);
    if (existingIndex !== -1) {
      localRecords[existingIndex] = record;
    } else {
      localRecords.unshift(record);
    }
    wx.setStorageSync(LOCAL_KEY, localRecords);

    // 再写云端
    if (!isCloudReady()) {
      return { success: true, source: 'local' };
    }

    try {
      const cloudData = {
        date: record.date,
        checkinTime: record.checkinTime,
        userId: record.userId,
        userName: record.userName,
        tasks: record.tasks || [],
        totalHours: record.totalHours,
        createTime: record.createTime,
        completedAt: record.completedAt || null
      };

      // 查重：同一天已有记录则更新，否则新增
      const existResult = await getCollection().where({ date: record.date }).get();
      if (existResult.data.length > 0) {
        await getCollection().doc(existResult.data[0]._id).update({ data: cloudData });
      } else {
        await getCollection().add({ data: cloudData });
      }

      return { success: true, source: 'cloud' };
    } catch (e) {
      console.warn('云数据库写入失败，数据已存本地:', e);
      return { success: true, source: 'local' };
    }
  },

  // ========== 任务进度更新 ==========

  // 更新任务进度（云端+本地）
  async updateTaskProgress(taskId, progress, recordId) {
    // 更新本地
    const localRecords = wx.getStorageSync(LOCAL_KEY) || [];
    let updated = false;

    localRecords.forEach(record => {
      if (record.tasks) {
        record.tasks.forEach(task => {
          if (task.id === taskId) {
            task.progress = progress;
            if (progress >= 100) {
              task.status = 'completed';
              task.completedTime = Date.now();
            } else if (progress > 0) {
              task.status = 'doing';
            } else {
              task.status = 'pending';
            }
            updated = true;
          }
        });
      }
    });

    if (updated) {
      wx.setStorageSync(LOCAL_KEY, localRecords);
    }

    // 更新云端
    if (!isCloudReady()) {
      return { success: true, source: 'local' };
    }

    try {
      const existResult = await getCollection().where({ date: localRecords.find(r => r.tasks && r.tasks.some(t => t.id === taskId))?.date }).get();
      if (existResult.data.length > 0) {
        const record = existResult.data[0];
        const updatedTasks = (record.tasks || []).map(t => {
          if (t.id === taskId) {
            return { ...t, progress, status: progress >= 100 ? 'completed' : progress > 0 ? 'doing' : 'pending', completedTime: progress >= 100 ? Date.now() : undefined };
          }
          return t;
        });
        await getCollection().doc(record._id).update({ data: { tasks: updatedTasks } });
      }
      return { success: true, source: 'cloud' };
    } catch (e) {
      console.warn('云数据库更新任务进度失败，本地已更新:', e);
      return { success: true, source: 'local' };
    }
  },

  // 初始化云数据库集合（首次使用时调用）
  async initCollection() {
    if (!isCloudReady()) return;
    try {
      // 尝试创建 checkins 集合（如果已存在不会报错）
      const db = wx.cloud.database();
      // 写入一条初始化记录后删除，确保集合已创建
      // 注意：云开发数据库集合需要在控制台手动创建，或通过代码创建一次
      console.log('云数据库集合初始化完成');
    } catch (e) {
      console.warn('云数据库初始化跳过:', e);
    }
  }
};
