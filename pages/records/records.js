// pages/records/records.js
const app = getApp();

Page({
  data: {
    currentYear: 0,
    currentMonth: 0,
    currentMonthStr: '',
    viewMode: 'list',        // list | calendar
    records: [],
    calendarDays: [],        // 日历格子数据
    monthStats: {
      totalDays: 0,
      checkedDays: 0,
      totalHours: 0,
      avgTasks: 0,
      completionRate: '0%'
    },
    chartBars: [],           // 近7天柱状图数据
    selectedRecord: null
  },

  onShow() {
    const now = new Date();
    this.setData({ currentYear: now.getFullYear(), currentMonth: now.getMonth() + 1 });
    this.loadMonth(now.getFullYear(), now.getMonth() + 1);
    this.buildChart();
  },

  // 加载指定月份数据
  loadMonth(year, month) {
    const monthStr = `${year}年${month}月`;
    const allRecords = wx.getStorageSync('checkinRecords') || [];

    // 筛选本月记录
    const monthRecords = allRecords.filter(r => {
      const parts = r.date.split('-');
      return parseInt(parts[0]) === year && parseInt(parts[1]) === month;
    });

    const totalDays = this.getWorkdaysInMonth(year, month);
    const checkedDays = monthRecords.length;
    const totalHours = monthRecords.reduce((s, r) => s + parseFloat(r.totalHours || 0), 0);
    const totalTasks = monthRecords.reduce((s, r) => s + (r.tasks ? r.tasks.length : 0), 0);
    const avgTasks = checkedDays > 0 ? (totalTasks / checkedDays).toFixed(1) : 0;
    const completionRate = totalDays > 0 ? Math.round(checkedDays / totalDays * 100) + '%' : '0%';

    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const records = monthRecords.map(r => ({
      ...r,
      day: parseInt(r.date.split('-')[2]),
      weekday: weekdays[new Date(r.date).getDay()],
      taskCount: r.tasks ? r.tasks.length : 0,
      doneCount: r.tasks ? r.tasks.filter(t => (t.progress || 0) >= 100).length : 0
    })).sort((a, b) => b.day - a.day);

    this.setData({
      currentYear: year,
      currentMonth: month,
      currentMonthStr: monthStr,
      records,
      monthStats: { totalDays, checkedDays, totalHours: totalHours.toFixed(1), avgTasks, completionRate }
    });

    this.buildCalendar(year, month, monthRecords);
  },

  // 构建日历格子
  buildCalendar(year, month, monthRecords) {
    const checkedDates = new Set(monthRecords.map(r => r.date));
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();

    const days = [];
    // 前置空格
    for (let i = 0; i < firstDay; i++) {
      days.push({ empty: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const date = new Date(year, month - 1, d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = date.toDateString() === today.toDateString();
      const isFuture = date > today;
      const isChecked = checkedDates.has(dateStr);
      const record = monthRecords.find(r => r.date === dateStr);

      days.push({
        empty: false,
        day: d,
        dateStr,
        isWeekend,
        isToday,
        isFuture,
        isChecked,
        isMissed: !isChecked && !isWeekend && !isFuture && date <= today,
        progress: record ? this.calcDayProgress(record) : 0
      });
    }

    this.setData({ calendarDays: days });
  },

  // 计算某天任务完成进度（平均）
  calcDayProgress(record) {
    if (!record.tasks || record.tasks.length === 0) return 0;
    const avg = record.tasks.reduce((s, t) => s + (t.progress || 0), 0) / record.tasks.length;
    return Math.round(avg);
  },

  // 构建近7天柱状图
  buildChart() {
    const allRecords = wx.getStorageSync('checkinRecords') || [];
    const bars = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const record = allRecords.find(r => r.date === dateStr);
      const hours = record ? parseFloat(record.totalHours || 0) : 0;
      bars.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        hours,
        height: Math.min(Math.round(hours / 10 * 100), 100),   // 最高10h = 100%
        isToday: i === 0,
        hasData: !!record
      });
    }
    this.setData({ chartBars: bars });
  },

  // 工作日天数
  getWorkdaysInMonth(year, month) {
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    const endDay = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= endDay; d++) {
      const w = new Date(year, month - 1, d).getDay();
      if (w !== 0 && w !== 6) count++;
    }
    return count;
  },

  // 上个月
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    this.loadMonth(currentYear, currentMonth);
  },

  // 下个月
  nextMonth() {
    const now = new Date();
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    if (currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth > now.getMonth() + 1)) {
      wx.showToast({ title: '无法查看未来月份', icon: 'none' });
      return;
    }
    this.loadMonth(currentYear, currentMonth);
  },

  // 切换视图
  switchView(e) {
    this.setData({ viewMode: e.currentTarget.dataset.mode });
  },

  // 查看打卡详情
  viewRecord(e) {
    const recordId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/checkin/checkin?mode=view&recordId=${recordId}` });
  },

  // 点击日历格子
  onCalendarDayTap(e) {
    const { datestr, ischecked } = e.currentTarget.dataset;
    if (!ischecked) return;
    const allRecords = wx.getStorageSync('checkinRecords') || [];
    const record = allRecords.find(r => r.date === datestr);
    if (record) {
      wx.navigateTo({ url: `/pages/checkin/checkin?mode=view&recordId=${record.id}` });
    }
  }
});
