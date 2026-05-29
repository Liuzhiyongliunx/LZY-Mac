/**
 * 云数据库服务 + 本地存储双写
 * 每次操作直接尝试云端，失败自动降级到本地存储
 */

const LOCAL_KEY = 'checkinRecords';

// 尝试获取云数据库集合引用，失败返回 null
function tryGetCollection() {
  try {
    if (typeof wx !== 'undefined' && wx.cloud) {
      return wx.cloud.database().collection('checkins');
    }
  } catch (e) {
    // 云开发不可用
  }
  return null;
}

module.exports = {

  // ========== 获取所有记录 ==========
  async getAllRecords() {
    const localRecords = wx.getStorageSync(LOCAL_KEY) || [];
    const collection = tryGetCollection();
    if (!collection) return localRecords;

    try {
      const cloudResult = await collection.get();
      const cloudRecords = (cloudResult.data || []).map(r => ({
        id: r._id,
        date: r.date,
        checkinTime: r.checkinTime,
        userId: r.userId,
        userName: r.userName,
        tasks: r.tasks || [],
        totalHours: r.totalHours,
        createTime: r.createTime
      }));

      // 合并：云数据优先，本地补充
      const seenDates = new Set();
      const merged = [];

      cloudRecords.forEach(r => { merged.push(r); seenDates.add(r.date); });
      localRecords.forEach(r => { if (!seenDates.has(r.date)) { merged.push(r); seenDates.add(r.date); } });

      return merged;
    } catch (e) {
      console.warn('[DB] 云读取失败，用本地:', e);
      return localRecords;
    }
  },

  // ========== 保存打卡记录 ==========
  async saveCheckin(record) {
    // 先写本地
    const localRecords = wx.getStorageSync(LOCAL_KEY) || [];
    const idx = localRecords.findIndex(r => r.date === record.date);
    if (idx !== -1) localRecords[idx] = record;
    else localRecords.unshift(record);
    wx.setStorageSync(LOCAL_KEY, localRecords);

    // 再写云端
    const collection = tryGetCollection();
    if (!collection) return { success: true, source: 'local' };

    try {
      const cloudData = {
        date: record.date,
        checkinTime: record.checkinTime,
        userId: record.userId,
        userName: record.userName,
        tasks: record.tasks || [],
        totalHours: record.totalHours,
        createTime: record.createTime
      };

      const exist = await collection.where({ date: record.date }).get();
      if (exist.data.length > 0) {
        await collection.doc(exist.data[0]._id).update({ data: cloudData });
      } else {
        await collection.add({ data: cloudData });
      }
      return { success: true, source: 'cloud' };
    } catch (e) {
      console.warn('[DB] 云写入失败，已存本地:', e);
      return { success: true, source: 'local' };
    }
  },

  // ========== 更新任务进度 ==========
  async updateTaskProgress(taskId, progress) {
    // 更新本地
    const localRecords = wx.getStorageSync(LOCAL_KEY) || [];
    let updated = false;
    let targetDate = null;

    localRecords.forEach(record => {
      if (record.tasks) {
        record.tasks.forEach(task => {
          if (task.id === taskId) {
            task.progress = progress;
            task.status = progress >= 100 ? 'completed' : progress > 0 ? 'doing' : 'pending';
            if (progress >= 100) task.completedTime = Date.now();
            targetDate = record.date;
            updated = true;
          }
        });
      }
    });
    if (updated) wx.setStorageSync(LOCAL_KEY, localRecords);

    // 更新云端
    const collection = tryGetCollection();
    if (!collection || !targetDate) return { success: true, source: 'local' };

    try {
      const exist = await collection.where({ date: targetDate }).get();
      if (exist.data.length > 0) {
        const updatedTasks = (exist.data[0].tasks || []).map(t => {
          if (t.id === taskId) {
            return { ...t, progress, status: progress >= 100 ? 'completed' : progress > 0 ? 'doing' : 'pending' };
          }
          return t;
        });
        await collection.doc(exist.data[0]._id).update({ data: { tasks: updatedTasks } });
      }
      return { success: true, source: 'cloud' };
    } catch (e) {
      console.warn('[DB] 云更新进度失败，本地已更新:', e);
      return { success: true, source: 'local' };
    }
  }
};
