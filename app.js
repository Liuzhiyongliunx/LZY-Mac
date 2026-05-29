// IPD项目管理小程序
App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    // 云开发环境ID
    cloudEnv: 'YOUR_CLOUD_ENV_ID'
  },

  onLaunch() {
    // 检查登录状态
    this.checkLoginStatus();
    
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: this.globalData.cloudEnv,
        traceUser: true,
      });
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
