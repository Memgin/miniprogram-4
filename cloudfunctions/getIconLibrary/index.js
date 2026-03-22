const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const TW = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

function normalizeIconUrl(url) {
  let normalized = String(url || '').trim();
  if (!normalized) return '';

  normalized = normalized.replace(
    'https://raw.githubusercontent.com/twitter/twemoji/v14.0.2/assets/72x72/',
    `${TW}/`
  );

  normalized = normalized.replace(/-fe0f(?=\.png$)/i, '');
  return normalized;
}

const DEFAULT_ICON_LIBRARY = [
  { id: 'phone', name: '手机', category: '数码', url: `${TW}/1f4f1.png` },
  { id: 'tablet', name: '平板', category: '数码', url: `${TW}/1f4f2.png` },
  { id: 'laptop', name: '电脑', category: '数码', url: `${TW}/1f4bb.png` },
  { id: 'desktop', name: '台式机', category: '数码', url: `${TW}/1f5a5.png` },
  { id: 'keyboard', name: '键盘', category: '数码', url: `${TW}/2328.png` },
  { id: 'mouse', name: '鼠标', category: '数码', url: `${TW}/1f5b1.png` },
  { id: 'printer', name: '打印机', category: '数码', url: `${TW}/1f5a8.png` },
  { id: 'camera', name: '相机', category: '数码', url: `${TW}/1f4f7.png` },
  { id: 'video_camera', name: '摄像机', category: '数码', url: `${TW}/1f4f9.png` },
  { id: 'headphone', name: '耳机', category: '数码', url: `${TW}/1f3a7.png` },
  { id: 'microphone', name: '麦克风', category: '数码', url: `${TW}/1f3a4.png` },
  { id: 'radio', name: '收音机', category: '数码', url: `${TW}/1f4fb.png` },
  { id: 'tv', name: '电视', category: '数码', url: `${TW}/1f4fa.png` },
  { id: 'watch', name: '手表', category: '数码', url: `${TW}/231a.png` },
  { id: 'alarm_clock', name: '闹钟', category: '数码', url: `${TW}/23f0.png` },
  { id: 'battery', name: '电池', category: '数码', url: `${TW}/1f50b.png` },
  { id: 'gamepad', name: '游戏机', category: '数码', url: `${TW}/1f3ae.png` },
  { id: 'joystick', name: '摇杆', category: '数码', url: `${TW}/1f579-fe0f.png` },

  { id: 'fridge', name: '冰箱', category: '家电', url: `${TW}/1f9ca.png` },
  { id: 'microwave', name: '微波炉', category: '家电', url: `${TW}/1f9f2.png` },
  { id: 'toaster', name: '烤面包机', category: '家电', url: `${TW}/1f9c7.png` },
  { id: 'washing_machine', name: '洗衣机', category: '家电', url: `${TW}/1f9fa.png` },
  { id: 'vacuum', name: '吸尘器', category: '家电', url: `${TW}/1f9f9.png` },
  { id: 'fan', name: '风扇', category: '家电', url: `${TW}/1faad.png` },
  { id: 'light_bulb', name: '灯泡', category: '家电', url: `${TW}/1f4a1.png` },
  { id: 'plug', name: '插头', category: '家电', url: `${TW}/1f50c.png` },

  { id: 'shirt', name: '上衣', category: '穿搭', url: `${TW}/1f455.png` },
  { id: 'dress', name: '裙子', category: '穿搭', url: `${TW}/1f457.png` },
  { id: 'shoe', name: '鞋子', category: '穿搭', url: `${TW}/1f45f.png` },
  { id: 'sandal', name: '凉鞋', category: '穿搭', url: `${TW}/1f461.png` },
  { id: 'bag', name: '手提包', category: '穿搭', url: `${TW}/1f45c.png` },
  { id: 'backpack', name: '双肩包', category: '穿搭', url: `${TW}/1f392.png` },
  { id: 'lipstick', name: '口红', category: '穿搭', url: `${TW}/1f484.png` },
  { id: 'ring', name: '戒指', category: '穿搭', url: `${TW}/1f48d.png` },

  { id: 'bike', name: '自行车', category: '交通', url: `${TW}/1f6b2.png` },
  { id: 'motorcycle', name: '摩托车', category: '交通', url: `${TW}/1f3cd-fe0f.png` },
  { id: 'car', name: '汽车', category: '交通', url: `${TW}/1f697.png` },
  { id: 'taxi', name: '出租车', category: '交通', url: `${TW}/1f695.png` },
  { id: 'bus', name: '公交车', category: '交通', url: `${TW}/1f68c.png` },
  { id: 'truck', name: '货车', category: '交通', url: `${TW}/1f69a.png` },
  { id: 'train', name: '高铁', category: '交通', url: `${TW}/1f686.png` },
  { id: 'airplane', name: '飞机', category: '交通', url: `${TW}/2708-fe0f.png` },
  { id: 'ship', name: '轮船', category: '交通', url: `${TW}/1f6a2.png` },

  { id: 'house', name: '房子', category: '房产', url: `${TW}/1f3e0.png` },
  { id: 'apartment', name: '公寓', category: '房产', url: `${TW}/1f3e2.png` },
  { id: 'office', name: '办公楼', category: '房产', url: `${TW}/1f3e2.png` },
  { id: 'hotel', name: '酒店', category: '房产', url: `${TW}/1f3e8.png` },
  { id: 'factory', name: '工厂', category: '房产', url: `${TW}/1f3ed.png` },

  { id: 'book', name: '图书', category: '学习', url: `${TW}/1f4d6.png` },
  { id: 'notebook', name: '笔记本', category: '学习', url: `${TW}/1f4d3.png` },
  { id: 'pencil', name: '铅笔', category: '学习', url: `${TW}/270f-fe0f.png` },
  { id: 'ruler', name: '尺子', category: '学习', url: `${TW}/1f4cf.png` },
  { id: 'briefcase', name: '公文包', category: '学习', url: `${TW}/1f4bc.png` },

  { id: 'soccer', name: '足球', category: '运动', url: `${TW}/26bd.png` },
  { id: 'basketball', name: '篮球', category: '运动', url: `${TW}/1f3c0.png` },
  { id: 'tennis', name: '网球', category: '运动', url: `${TW}/1f3be.png` },
  { id: 'running', name: '跑步', category: '运动', url: `${TW}/1f3c3.png` },
  { id: 'swim', name: '游泳', category: '运动', url: `${TW}/1f3ca-fe0f.png` },
  { id: 'dumbbell', name: '哑铃', category: '运动', url: `${TW}/1f3cb-fe0f.png` },

  { id: 'dog', name: '狗狗', category: '宠物', url: `${TW}/1f436.png` },
  { id: 'cat', name: '猫咪', category: '宠物', url: `${TW}/1f431.png` },
  { id: 'bird', name: '小鸟', category: '宠物', url: `${TW}/1f426.png` },
  { id: 'fish', name: '小鱼', category: '宠物', url: `${TW}/1f41f.png` },

  { id: 'gift', name: '礼物', category: '其他', url: `${TW}/1f381.png` },
  { id: 'money', name: '投资', category: '其他', url: `${TW}/1f4b0.png` },
  { id: 'credit_card', name: '信用卡', category: '其他', url: `${TW}/1f4b3.png` },
  { id: 'chart', name: '图表', category: '其他', url: `${TW}/1f4c8.png` },
  { id: 'coffee', name: '咖啡', category: '其他', url: `${TW}/2615.png` },
  { id: 'tea', name: '茶杯', category: '其他', url: `${TW}/1f375.png` },
  { id: 'burger', name: '汉堡', category: '其他', url: `${TW}/1f354.png` },
  { id: 'pizza', name: '披萨', category: '其他', url: `${TW}/1f355.png` }
];

exports.main = async () => {
  try {
    const envJson = process.env.ICON_LIBRARY_JSON || '';
    let icons = DEFAULT_ICON_LIBRARY;

    if (envJson) {
      try {
        const parsed = JSON.parse(envJson);
        if (Array.isArray(parsed) && parsed.length) {
          icons = parsed;
        }
      } catch (e) {
      }
    }

    const safeIcons = icons
      .map((item) => ({
        id: String(item.id || ''),
        name: String(item.name || ''),
        category: String(item.category || '其他'),
        url: normalizeIconUrl(item.url || '')
      }))
      .filter((item) => item.id && item.name && item.url)
      .filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index);

    return {
      success: true,
      data: safeIcons
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'getIconLibrary failed'
    };
  }
};
