// pages/tasks/tasks.js
const app = getApp();
const db = require('../../utils/db');

Page({
  data: {
    allTasks: [],
    filteredTasks: [],
    activeFilter: 'all',   // all | pending | doing | done
    filters: [
      { key: 'all',     label: '全部' },
      { key: 'pending', label: '待开始' },
      { key: 'doing',   label: '进行中' },
      { key: 'done',    label: '已完成' }
    ],
    stats: {
      total: 0,
      pending: 0,
      doing: 0,
      done: 0
    }
  },

  onShow() {
    this.loadTasks();
  },

  // 加载所有任务（云端+本地）
  async loadTasks() {
    const records = await db.getAllRecords();
    const allTasks = [];

    records.forEach(record => {
      if (record.tasks && record.tasks.length > 0) {
        record.tasks.forEach(task => {
          allTasks.push({
            ...task,
            date: record.date,
            recordId: record.id,
            progress: task.progress || 0,
            statusLabel: this.getStatusLabel(task.progress || 0),
            priorityText: this.getPriorityText(task.priority),
            deadlineDisplay: task.deadline ? this.formatDeadline(task.deadline) : '',
            isOverdue: task.deadline ? this.isOverdue(task.deadline, task.progress) : false
          });
        });
      }
    });

    // 按日期排序（最新在前）
    allTasks.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 统计
    const stats = {
      total: allTasks.length,
      pending: allTasks.filter(t => (t.progress || 0) === 0).length,
      doing:   allTasks.filter(t => (t.progress || 0) > 0 && (t.progress || 0) < 100).length,
      done:    allTasks.filter(t => (t.progress || 0) >= 100).length
    };

    this.setData({ allTasks, stats });
    this.applyFilter(this.data.activeFilter);
  },

  // 获取状态文字
  getStatusLabel(progress) {
    if (progress >= 100) return '已完成';
    if (progress > 0)   return '进行中';
    return '待开始';
  },

  // 获取优先级文字
  getPriorityText(priority) {
    const map = { high: '高', medium: '中', low: '低' };
    return map[priority] || '中';
  },

  // 格式化截止日期显示
  formatDeadline(deadline) {
    const d = new Date(deadline);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  // 判断是否逾期
  isOverdue(deadline, progress) {
    if ((progress || 0) >= 100) return false;
    return new Date(deadline) < new Date();
  },

  // 切换筛选
  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ activeFilter: filter });
    this.applyFilter(filter);
  },

  // 应用筛选
  applyFilter(filter) {
    const { allTasks } = this.data;
    let filtered;
    if (filter === 'pending') {
      filtered = allTasks.filter(t => t.progress === 0);
    } else if (filter === 'doing') {
      filtered = allTasks.filter(t => t.progress > 0 && t.progress < 100);
    } else if (filter === 'done') {
      filtered = allTasks.filter(t => t.progress >= 100);
    } else {
      filtered = allTasks;
    }
    this.setData({ filteredTasks: filtered });
  },

  // 进度滑动改变
  onProgressChange(e) {
    const taskId = e.currentTarget.dataset.taskid;
    const progress = e.detail.value;
    this.updateTaskProgress(taskId, progress);
  },

  // 快速设置进度
  setProgress(e) {
    const { taskid, value } = e.currentTarget.dataset;
    this.updateTaskProgress(taskid, value);
  },

  // 更新任务进度（云端+本地）
  async updateTaskProgress(taskId, progress) {
    await db.updateTaskProgress(taskId, progress);
    this.loadTasks();

    if (progress >= 100) {
      wx.showToast({ title: '任务已完成！🎉', icon: 'success' });
    }
  },

  // 标记完成
  markDone(e) {
    const taskId = e.currentTarget.dataset.taskid;
    wx.showModal({
      title: '确认完成',
      content: '将此任务标记为已完成？',
      success: res => {
        if (res.confirm) this.updateTaskProgress(taskId, 100);
      }
    });
  },

  // ✅ 任务永久存储，不支持删除操作

  // 跳转到打卡页面添加任务
  goAddTask() {
    wx.navigateTo({ url: '/pages/checkin/checkin' });
  }
});
