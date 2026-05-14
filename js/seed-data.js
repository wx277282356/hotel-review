/**
 * seed-data.js
 * 在浏览器控制台运行此脚本，可以生成一批示例测试数据
 * Run this in browser DevTools console to generate sample data
 */
(function seedSampleData() {
  const reasons = ['服务差', '卫生差', '态度差', '等待太久', '响应不及时', '设施老旧', '空调/热水问题', '网络差'];
  const reviews = [];
  const now = new Date();

  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(Math.floor(Math.random() * 14) + 8);
    d.setMinutes(Math.floor(Math.random() * 60));

    const isPos = Math.random() > 0.28;
    const r = {
      id: Date.now() + i,
      type: isPos ? 'positive' : 'negative',
      reasons: isPos ? [] : [reasons[Math.floor(Math.random() * reasons.length)]],
      createdAt: d.toISOString()
    };
    reviews.push(r);
  }

  const existing = JSON.parse(localStorage.getItem('hr_reviews') || '[]');
  localStorage.setItem('hr_reviews', JSON.stringify([...reviews, ...existing]));
  console.log('✅ 已生成 60 条示例数据 / 60 sample reviews generated. Refresh the page!');
})();
