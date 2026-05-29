// pages/checkin/checkin.js
const app = getApp();

Page({
  data: {
    today: '',
    weekday: '',
    currentTime: '',
    taskList: [],
    totalHours: 0,
    workloadLevel: '适中',
    isSubmitting: false,
    showModal: false,
    editingTask: null,
    taskForm: {
      name: '',
      description: '',
      estimatedTime: 1,
      priority: 'medium',
      deadline: ''
    }
  },

  onLoad(options) {
    // 如果是查看模式
    if (options.mode === 'view' && options.recordId) {
      this.loadRecord(options.recordId);
    }
    
    this.initData();
    this.updateTime();
    // 每分钟更新时间
    this.timer = setInterval(() => {
      this.updateTime();
    }, 60000);
  },

  onUnload() {
    // 离开页面时保存任务草稿
    if (this.data.taskList.length > 0) {
      this.saveDraft();
    }
    if (this.timer) {
      clearInterval(this.timer);
    }
  },

  onHide() {
    // 页面隐藏时也保存草稿
    if (this.data.taskList.length > 0) {
      this.saveDraft();
    }
  },

  // 初始化数据
  initData() {
    const now = new Date();
    const today = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[now.getDay()];
    
    // 从本地存储加载今日任务草稿
    const todayStr = app.getTodayString();
    const draft = wx.getStorageSync('taskDraft') || {};
    const todayDraft = draft[todayStr] || { tasks: [] };
    
    this.setData({
      today,
      weekday,
      taskList: todayDraft.tasks || []
    });
    
    this.calculateStats();
  },

  // 更新时间
  updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    this.setData({
      currentTime: `${hours}:${minutes}`
    });
  },

  // 计算统计数据
  calculateStats() {
    const totalHours = this.data.taskList.reduce((sum, task) => {
      return sum + (parseFloat(task.estimatedTime) || 0);
    }, 0);
    
    let workloadLevel = '轻松';
    if (totalHours >= 8) {
      workloadLevel = '繁忙';
    } else if (totalHours >= 6) {
      workloadLevel = '适中';
    } else if (totalHours > 0) {
      workloadLevel = '轻松';
    }
    
    this.setData({
      totalHours: totalHours.toFixed(1),
      workloadLevel
    });
  },

  // 保存任务草稿到本地
  saveDraft() {
    const todayStr = app.getTodayString();
    const draft = wx.getStorageSync('taskDraft') || {};
    draft[todayStr] = {
      tasks: this.data.taskList,
      updateTime: Date.now()
    };
    wx.setStorageSync('taskDraft', draft);
  },

  // 显示添加任务弹窗
  showAddTask() {
    this.setData({
      showModal: true,
      editingTask: null,
      taskForm: {
        name: '',
        description: '',
        estimatedTime: 1,
        priority: 'medium',
        deadline: ''
      }
    });
    // 尝试恢复未提交的表单草稿
    this.restoreFormDraft();
  },

  // 编辑任务
  editTask(e) {
    const taskId = e.currentTarget.dataset.id;
    const task = this.data.taskList.find(t => t.id === taskId);
    if (task) {
      this.setData({
        showModal: true,
        editingTask: task,
        taskForm: {
          name: task.name,
          description: task.description || '',
          estimatedTime: task.estimatedTime,
          priority: task.priority || 'medium',
          deadline: task.deadline || ''
        }
      });
    }
  },

  // 删除任务
  deleteTask(e) {
    const taskId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个任务吗？',
      success: res => {
        if (res.confirm) {
          const taskList = this.data.taskList.filter(t => t.id !== taskId);
          this.setData({ taskList });
          this.calculateStats();
          this.saveDraft();
        }
      }
    });
  },

  // 隐藏弹窗（强制保存草稿防止内容丢失）
  hideModal() {
    // 强制保存表单草稿，不管是否有内容
    this.forceSaveFormDraft();
    this.setData({
      showModal: false,
      editingTask: null
    });
    wx.showToast({
      title: '草稿已保存',
      icon: 'none',
      duration: 1500
    });
  },

  // 强制保存表单草稿
  forceSaveFormDraft() {
    const todayStr = app.getTodayString();
    const draft = wx.getStorageSync('taskFormDraft') || {};
    draft[todayStr] = {
      name: this.data.taskForm.name || '',
      description: this.data.taskForm.description || '',
      estimatedTime: this.data.taskForm.estimatedTime || 1,
      priority: this.data.taskForm.priority || 'medium',
      updateTime: Date.now()
    };
    wx.setStorageSync('taskFormDraft', draft);
    console.log('[DEBUG] 表单草稿已保存:', draft[todayStr]);
  },

  // 任务名称输入
  onTaskNameInput(e) {
    this.setData({
      'taskForm.name': e.detail.value
    });
    this.autoSaveForm();
  },

  // 任务描述输入
  onTaskDescInput(e) {
    this.setData({
      'taskForm.description': e.detail.value
    });
    this.autoSaveForm();
  },

  // 自动保存表单草稿（防止内容丢失）
  autoSaveForm() {
    if (this.data.taskForm.name || this.data.taskForm.description) {
      const todayStr = app.getTodayString();
      const draft = wx.getStorageSync('taskFormDraft') || {};
      draft[todayStr] = {
        ...this.data.taskForm,
        updateTime: Date.now()
      };
      wx.setStorageSync('taskFormDraft', draft);
    }
  },

  // 恢复表单草稿
  restoreFormDraft() {
    const todayStr = app.getTodayString();
    const draft = wx.getStorageSync('taskFormDraft') || {};
    const todayDraft = draft[todayStr];
    if (todayDraft && !this.data.editingTask) {
      // 只有在非编辑模式且有草稿时才恢复
      this.setData({
        taskForm: {
          name: todayDraft.name || '',
          description: todayDraft.description || '',
          estimatedTime: todayDraft.estimatedTime || 1,
          priority: todayDraft.priority || 'medium'
        }
      });
    }
    // 清除表单草稿
    delete draft[todayStr];
    wx.setStorageSync('taskFormDraft', draft);
  },

  // 设置预计时间
  setEstimatedTime(e) {
    const time = parseFloat(e.currentTarget.dataset.time);
    this.setData({
      'taskForm.estimatedTime': time
    });
    this.autoSaveForm();
  },

  // 设置优先级
  setPriority(e) {
    const priority = e.currentTarget.dataset.priority;
    this.setData({
      'taskForm.priority': priority
    });
    this.autoSaveForm();
  },

  // 设置截止日期
  onDeadlineChange(e) {
    this.setData({ 'taskForm.deadline': e.detail.value });
    this.autoSaveForm();
  },

  // 清除截止日期
  clearDeadline() {
    this.setData({ 'taskForm.deadline': '' });
  },

  // 保存任务
  saveTask() {
    const { name, estimatedTime } = this.data.taskForm;
    
    if (!name || !name.trim()) {
      wx.showToast({
        title: '请输入任务名称',
        icon: 'none'
      });
      return;
    }
    
    if (!estimatedTime || estimatedTime <= 0) {
      wx.showToast({
        title: '请选择预计时间',
        icon: 'none'
      });
      return;
    }
    
    let taskList = [...this.data.taskList];
    
    if (this.data.editingTask) {
      // 编辑模式
      const index = taskList.findIndex(t => t.id === this.data.editingTask.id);
      if (index !== -1) {
        taskList[index] = {
          ...taskList[index],
          ...this.data.taskForm
        };
      }
    } else {
      // 新增模式
      taskList.push({
        id: `task_${Date.now()}`,
        ...this.data.taskForm,
        status: 'pending'
      });
    }
    
    this.setData({
      taskList,
      showModal: false,
      editingTask: null
    });
    
    this.calculateStats();
    this.saveDraft();
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  // 提交打卡
  submitCheckin() {
    if (this.data.taskList.length === 0) {
      wx.showModal({
        title: '提示',
        content: '还没有添加工作任务，是否确认打卡？',
        success: res => {
          if (res.confirm) {
            this.doCheckin();
          }
        }
      });
      return;
    }
    
    this.doCheckin();
  },

  // 执行打卡
  doCheckin() {
    if (this.data.isSubmitting) return;
    
    this.setData({ isSubmitting: true });
    
    const userInfo = app.globalData.userInfo;
    const now = new Date();
    const checkinTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const record = {
      id: `record_${Date.now()}`,
      date: app.getTodayString(),
      checkinTime,
      userId: userInfo.openid,
      userName: userInfo.nickname,
      tasks: this.data.taskList,
      totalHours: this.data.totalHours,
      createTime: Date.now()
    };
    
    // 保存到本地记录
    const records = wx.getStorageSync('checkinRecords') || [];
    const todayStr = app.getTodayString();
    const existingIndex = records.findIndex(r => r.date === todayStr);
    
    if (existingIndex !== -1) {
      records[existingIndex] = record;
    } else {
      records.unshift(record);
    }
    
    wx.setStorageSync('checkinRecords', records);
    
    // 清除今日草稿
    const todayStr2 = app.getTodayString();
    const draft = wx.getStorageSync('taskDraft') || {};
    delete draft[todayStr2];
    wx.setStorageSync('taskDraft', draft);
    
    this.setData({ isSubmitting: false });
    
    wx.showToast({
      title: '打卡成功',
      icon: 'success'
    });
    
    // 延迟跳转到任务页面
    setTimeout(() => {
      wx.switchTab({ url: '/pages/tasks/tasks' });
    }, 1500);
  },

  // 加载已有记录（查看模式）
  loadRecord(recordId) {
    const records = wx.getStorageSync('checkinRecords') || [];
    const record = records.find(r => r.id === recordId);
    if (record) {
      this.setData({
        taskList: record.tasks || []
      });
      this.calculateStats();
    }
  }
})
