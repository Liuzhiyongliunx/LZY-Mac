// pages/index/index.js
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    today: '',
    weekday: '',
    isWorkday: true,
    hasCheckedIn: false,
    remindEnabled: true,
    todayRecord: null,
    pendingTasks: [],
    pendingTasksCount: 0
  },

  onLoad() {
    this.initData();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.initData();
    this.checkTodayCheckin();
    this.loadPendingTasks();
  },

  // 初始化数据
  initData() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const userInfo = app.globalData.userInfo;
    
    // 获取今天的日期
    const now = new Date();
    const today = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[now.getDay()];
    const isWorkday = app.isWorkday();
    
    // 获取提醒设置
    const remindEnabled = wx.getStorageSync('remindEnabled') !== false;
    
    this.setData({
      isLoggedIn,
      userInfo,
      today,
      weekday,
      isWorkday,
      remindEnabled
    });
  },

  // 检查今日打卡状态
  checkTodayCheckin() {
    if (!app.globalData.isLoggedIn) return;
    
    const today = app.getTodayString();
    const records = wx.getStorageSync('checkinRecords') || [];
    const todayRecord = records.find(r => r.date === today);
    
    this.setData({
      hasCheckedIn: !!todayRecord,
      todayRecord: todayRecord || null
    });
  },

  // 加载待办任务
  loadPendingTasks() {
    const records = wx.getStorageSync('checkinRecords') || [];
    const allTasks = [];
    
    records.forEach(record => {
      if (record.tasks && record.tasks.length > 0) {
        record.tasks.forEach(task => {
          // 只显示未完成的任务
          if (!task.progress || task.progress < 100) {
            allTasks.push({
              ...task,
              date: record.date
            });
          }
        });
      }
    });
    
    // 按日期排序（最新的在前）
    allTasks.sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    // 只显示前5个
    const pendingTasks = allTasks.slice(0, 5);
    
    this.setData({
      pendingTasks,
      pendingTasksCount: allTasks.length
    });
  },

  // 微信一键登录
  onGetPhoneNumber(e) {
    // 模拟登录模式（测试号专用）
    this.simulateLogin();
  },

  // 模拟登录（测试号/开发模式）
  simulateLogin() {
    const userInfo = {
      openid: 'test_user_001',
      nickname: '测试用户',
      avatarUrl: '/assets/default-avatar.png',
      department: '研发部'
    };
    app.saveUserInfo(userInfo);
    this.initData();
    this.checkTodayCheckin();
    this.loadPendingTasks();
    wx.showToast({
      title: '登录成功',
      icon: 'success'
    });
  },

  // 手动登录
  onManualLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          app.clearLogin();
          this.initData();
        }
      }
    });
  },

  // 跳转到打卡页面
  goToCheckin() {
    if (!app.globalData.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.isWorkday) {
      wx.showToast({
        title: '今日休息日',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/checkin/checkin'
    });
  },

  // 查看今日计划
  viewTodayPlan() {
    if (this.data.todayRecord) {
      wx.navigateTo({
        url: `/pages/checkin/checkin?mode=view&recordId=${this.data.todayRecord.id}`
      });
    }
  },

  // 跳转到打卡记录
  goToRecords() {
    wx.navigateTo({
      url: '/pages/records/records'
    });
  },

  // 跳转到统计
  goToStats() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 跳转到任务页面
  goToTasks() {
    wx.switchTab({
      url: '/pages/tasks/tasks'
    });
  },

  // 跳转到设置
  goToSettings() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 打卡提醒开关
  onRemindChange(e) {
    const enabled = e.detail.value;
    wx.setStorageSync('remindEnabled', enabled);
    
    if (enabled) {
      this.requestRemindPermission();
    } else {
      wx.showToast({
        title: '已关闭提醒',
        icon: 'none'
      });
    }
  },

  // 请求订阅消息权限
  requestRemindPermission() {
    wx.requestSubscribeMessage({
      tmplIds: ['YOUR_TEMPLATE_ID'], // 替换为实际的模板消息ID
      success: res => {
        if (res['YOUR_TEMPLATE_ID'] === 'accept') {
          wx.showToast({
            title: '已开启提醒',
            icon: 'success'
          });
        }
      },
      fail: err => {
        console.error('订阅消息失败', err);
      }
    });
  }
})
