// IPD项目管理小程序
App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    // 云开发环境ID
    cloudEnv: 'ipd-project-d0ghhllv9d3fdea86'
  },

  onLaunch() {
    // 检查登录状态
    this.checkLoginStatus();
    
    // 尝试初始化云开发（如果已开通则启用，未开通则静默跳过）
    try {
      if (wx.cloud) {
        wx.cloud.init({
          env: this.globalData.cloudEnv,
          traceUser: true,
        });
        this.globalData.cloudReady = true;
        console.log('云开发已就绪');
        
        // 将本地已有数据同步到云端
        this.syncLocalToCloud();
      }
    } catch (e) {
      console.log('云开发未开通，使用本地存储模式');
      this.globalData.cloudReady = false;
    }
  },

  // 将本地存储的旧数据同步到云端（首次启动时执行）
  async syncLocalToCloud() {
    try {
      const LOCAL_KEY = 'checkinRecords';
      const localRecords = wx.getStorageSync(LOCAL_KEY) || [];
      if (localRecords.length === 0) return;
      
      const collection = wx.cloud.database().collection('checkins');
      for (const record of localRecords) {
        const exist = await collection.where({ date: record.date }).get();
        if (exist.data.length === 0) {
          await collection.add({
            data: {
              date: record.date,
              checkinTime: record.checkinTime,
              userId: record.userId,
              userName: record.userName,
              tasks: record.tasks || [],
              totalHours: record.totalHours,
              createTime: record.createTime
            }
          });
        }
      }
      console.log(`[Sync] 已同步 ${localRecords.length} 条本地记录到云端`);
    } catch (e) {
      console.warn('[Sync] 本地同步到云端失败（可忽略，后续写入会自动同步）:', e);
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
    }
  },

  // 保存用户信息
  saveUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    this.globalData.isLoggedIn = true;
    wx.setStorageSync('userInfo', userInfo);
  },

  // 清除登录状态
  clearLogin() {
    this.globalData.userInfo = null;
    this.globalData.isLoggedIn = false;
    wx.removeStorageSync('userInfo');
  },

  // 判断是否为工作日
  isWorkday() {
    const now = new Date();
    const day = now.getDay();
    // 0是周日，6是周六，工作日是1-5
    return day >= 1 && day <= 5;
  },

  // 获取今天的日期字符串
  getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
})
