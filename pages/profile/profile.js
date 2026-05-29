// pages/profile/profile.js
const app = getApp();
const db = require('../../utils/db');

Page({
  data: {
    userInfo: null,
    currentMonthStr: '',
    stats: {
      checkedDays: 0,
      totalDays: 0,
      totalHours: '0',
      completionRate: '0%',
      doneTasks: 0,
      totalTasks: 0,
      taskDoneRate: '0%'
    },
    monthProgress: 0,       // 月度打卡进度（0-100）
    showEditModal: false,
    editForm: {
      nickname: '',
      department: ''
    }
  },

  onShow() {
    this.loadUserInfo();
    this.loadStats();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = app.globalData.userInfo;
    this.setData({ userInfo });
  },

  // 加载统计数据（云端+本地）
  async loadStats() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}年${month}月`;

    // 计算工作日
    let totalDays = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const w = new Date(year, month - 1, d).getDay();
      if (w !== 0 && w !== 6) totalDays++;
    }

    const allRecords = await db.getAllRecords();
    const monthRecords = allRecords.filter(r => {
      const parts = r.date.split('-');
      return parseInt(parts[0]) === year && parseInt(parts[1]) === month;
    });

    const checkedDays = monthRecords.length;
    const totalHours = monthRecords.reduce((s, r) => s + parseFloat(r.totalHours || 0), 0);
    const completionRate = totalDays > 0 ? Math.round(checkedDays / totalDays * 100) + '%' : '0%';
    const monthProgress = totalDays > 0 ? Math.round(checkedDays / totalDays * 100) : 0;

    // 任务完成率
    let totalTasks = 0, doneTasks = 0;
    monthRecords.forEach(r => {
      if (r.tasks) {
        totalTasks += r.tasks.length;
        doneTasks += r.tasks.filter(t => (t.progress || 0) >= 100).length;
      }
    });
    const taskDoneRate = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) + '%' : '0%';

    this.setData({
      currentMonthStr: monthStr,
      monthProgress,
      stats: {
        checkedDays,
        totalDays,
        totalHours: totalHours.toFixed(1),
        completionRate,
        doneTasks,
        totalTasks,
        taskDoneRate
      }
    });
  },

  // 修改昵称/部门
  editProfile() {
    const { userInfo } = this.data;
    this.setData({
      showEditModal: true,
      editForm: {
        nickname: userInfo ? userInfo.nickname : '',
        department: userInfo ? (userInfo.department || '') : ''
      }
    });
  },

  onNicknameInput(e) {
    this.setData({ 'editForm.nickname': e.detail.value });
  },

  onDeptInput(e) {
    this.setData({ 'editForm.department': e.detail.value });
  },

  saveProfile() {
    const { nickname, department } = this.data.editForm;
    if (!nickname || !nickname.trim()) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    const userInfo = { ...this.data.userInfo, nickname: nickname.trim(), department: department.trim() };
    app.saveUserInfo(userInfo);
    this.setData({ userInfo, showEditModal: false });
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  hideEditModal() {
    this.setData({ showEditModal: false });
  },

  // 导出打卡记录（生成文本摘要，云端+本地）
  async goToExport() {
    const allRecords = await db.getAllRecords();
    if (allRecords.length === 0) {
      wx.showToast({ title: '暂无记录可导出', icon: 'none' });
      return;
    }
    const now = new Date();
    const lines = [`IPD打卡记录导出 - ${now.toLocaleDateString()}\n`];
    allRecords.slice(0, 30).forEach(r => {
      lines.push(`📅 ${r.date} ${r.checkinTime} | 工时${r.totalHours}h | ${r.tasks ? r.tasks.length : 0}项任务`);
      if (r.tasks) {
        r.tasks.forEach(t => {
          lines.push(`  · [${t.priority || '中'}] ${t.name} - 进度${t.progress || 0}%`);
        });
      }
    });
    const content = lines.join('\n');
    wx.setClipboardData({
      data: content,
      success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
    });
  },

  // 关于
  goToAbout() {
    wx.showModal({
      title: 'IPD项目管理',
      content: '专为研发团队设计的每日打卡与工作规划工具。\n\n版本：1.1.0\n\n支持每日打卡、任务规划、进度跟踪、月度统计。',
      showCancel: false
    });
  },

  goToFeedback() {
    wx.showToast({ title: '感谢反馈 📮', icon: 'none' });
  },

  goToTeam() {
    wx.showToast({ title: '团队功能开发中', icon: 'none' });
  },

  goToRemind() {
    wx.showToast({ title: '提醒设置开发中', icon: 'none' });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需重新登录',
      success: res => {
        if (res.confirm) {
          app.clearLogin();
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }
    });
  }
});
