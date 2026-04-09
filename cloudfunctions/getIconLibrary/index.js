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
  { id: 'speaker', name: '音箱', category: '数码', url: `${TW}/1f50a.png` },
  { id: 'satellite_antenna', name: '天线', category: '数码', url: `${TW}/1f4e1.png` },
  { id: 'movie_camera', name: '电影机', category: '数码', url: `${TW}/1f3a5.png` },
  { id: 'flashlight', name: '手电筒', category: '数码', url: `${TW}/1f526.png` },
  { id: 'floppy_disk', name: '软盘', category: '数码', url: `${TW}/1f4be.png` },
  { id: 'optical_disc', name: '光盘', category: '数码', url: `${TW}/1f4bf.png` },

  { id: 'fridge', name: '冰箱', category: '家电', url: `${TW}/1f9ca.png` },
  { id: 'microwave', name: '微波炉', category: '家电', url: `${TW}/1f9f2.png` },
  { id: 'toaster', name: '烤面包机', category: '家电', url: `${TW}/1f9c7.png` },
  { id: 'washing_machine', name: '洗衣机', category: '家电', url: `${TW}/1f9fa.png` },
  { id: 'vacuum', name: '吸尘器', category: '家电', url: `${TW}/1f9f9.png` },
  { id: 'fan', name: '风扇', category: '家电', url: `${TW}/1faad.png` },
  { id: 'light_bulb', name: '灯泡', category: '家电', url: `${TW}/1f4a1.png` },
  { id: 'plug', name: '插头', category: '家电', url: `${TW}/1f50c.png` },
  { id: 'shower', name: '花洒', category: '家电', url: `${TW}/1f6bf.png` },
  { id: 'bathtub', name: '浴缸', category: '家电', url: `${TW}/1f6c1.png` },
  { id: 'toilet', name: '马桶', category: '家电', url: `${TW}/1f6bd.png` },
  { id: 'bed', name: '床', category: '家电', url: `${TW}/1f6cf-fe0f.png` },
  { id: 'door', name: '门', category: '家电', url: `${TW}/1f6aa.png` },

  { id: 'shirt', name: '上衣', category: '穿搭', url: `${TW}/1f455.png` },
  { id: 'dress', name: '裙子', category: '穿搭', url: `${TW}/1f457.png` },
  { id: 'shoe', name: '鞋子', category: '穿搭', url: `${TW}/1f45f.png` },
  { id: 'sandal', name: '凉鞋', category: '穿搭', url: `${TW}/1f461.png` },
  { id: 'bag', name: '手提包', category: '穿搭', url: `${TW}/1f45c.png` },
  { id: 'backpack', name: '双肩包', category: '穿搭', url: `${TW}/1f392.png` },
  { id: 'lipstick', name: '口红', category: '穿搭', url: `${TW}/1f484.png` },
  { id: 'ring', name: '戒指', category: '穿搭', url: `${TW}/1f48d.png` },
  { id: 'jeans', name: '牛仔裤', category: '穿搭', url: `${TW}/1f456.png` },
  { id: 'crown', name: '皇冠', category: '穿搭', url: `${TW}/1f451.png` },
  { id: 'glasses', name: '眼镜', category: '穿搭', url: `${TW}/1f453.png` },
  { id: 'scarf', name: '围巾', category: '穿搭', url: `${TW}/1f9e3.png` },
  { id: 'gloves', name: '手套', category: '穿搭', url: `${TW}/1f9e4.png` },
  { id: 'socks', name: '袜子', category: '穿搭', url: `${TW}/1f9e6.png` },

  { id: 'bike', name: '自行车', category: '交通', url: `${TW}/1f6b2.png` },
  { id: 'motorcycle', name: '摩托车', category: '交通', url: `${TW}/1f3cd-fe0f.png` },
  { id: 'car', name: '汽车', category: '交通', url: `${TW}/1f697.png` },
  { id: 'truck', name: '货车', category: '交通', url: `${TW}/1f69a.png` },
  { id: 'scooter', name: '滑板车', category: '交通', url: `${TW}/1f6f4.png` },
  { id: 'motor_scooter', name: '电瓶车', category: '交通', url: `${TW}/1f6f5.png` },
  { id: 'wheel', name: '车轮', category: '交通', url: `${TW}/1f6de.png` },

  { id: 'house', name: '房子', category: '房产', url: `${TW}/1f3e0.png` },
  { id: 'apartment', name: '公寓', category: '房产', url: `${TW}/1f3e2.png` },
  { id: 'doorway', name: '入户门', category: '房产', url: `${TW}/1f6aa.png` },

  { id: 'book', name: '图书', category: '学习', url: `${TW}/1f4d6.png` },
  { id: 'notebook', name: '笔记本', category: '学习', url: `${TW}/1f4d3.png` },
  { id: 'pencil', name: '铅笔', category: '学习', url: `${TW}/270f-fe0f.png` },
  { id: 'ruler', name: '尺子', category: '学习', url: `${TW}/1f4cf.png` },
  { id: 'briefcase', name: '公文包', category: '学习', url: `${TW}/1f4bc.png` },
  { id: 'graduation_cap', name: '学位帽', category: '学习', url: `${TW}/1f393.png` },
  { id: 'abacus', name: '算盘', category: '学习', url: `${TW}/1f9ee.png` },
  { id: 'clipboard', name: '剪贴板', category: '学习', url: `${TW}/1f4cb.png` },
  { id: 'pushpin', name: '图钉', category: '学习', url: `${TW}/1f4cc.png` },
  { id: 'memo', name: '便签', category: '学习', url: `${TW}/1f4dd.png` },

  { id: 'soccer', name: '足球', category: '运动', url: `${TW}/26bd.png` },
  { id: 'basketball', name: '篮球', category: '运动', url: `${TW}/1f3c0.png` },
  { id: 'tennis', name: '网球', category: '运动', url: `${TW}/1f3be.png` },
  { id: 'running', name: '跑步', category: '运动', url: `${TW}/1f3c3.png` },
  { id: 'swim', name: '游泳', category: '运动', url: `${TW}/1f3ca-fe0f.png` },
  { id: 'dumbbell', name: '哑铃', category: '运动', url: `${TW}/1f3cb-fe0f.png` },
  { id: 'ping_pong', name: '乒乓球', category: '运动', url: `${TW}/1f3d3-fe0f.png` },
  { id: 'badminton', name: '羽毛球', category: '运动', url: `${TW}/1f3f8.png` },
  { id: 'ski', name: '滑雪', category: '运动', url: `${TW}/26f7-fe0f.png` },
  { id: 'boxing_glove', name: '拳击', category: '运动', url: `${TW}/1f94a.png` },

  { id: 'dog', name: '狗狗', category: '宠物', url: `${TW}/1f436.png` },
  { id: 'cat', name: '猫咪', category: '宠物', url: `${TW}/1f431.png` },
  { id: 'bird', name: '小鸟', category: '宠物', url: `${TW}/1f426.png` },
  { id: 'fish', name: '小鱼', category: '宠物', url: `${TW}/1f41f.png` },
  { id: 'rabbit', name: '兔子', category: '宠物', url: `${TW}/1f430.png` },
  { id: 'hamster', name: '仓鼠', category: '宠物', url: `${TW}/1f439.png` },
  { id: 'turtle', name: '乌龟', category: '宠物', url: `${TW}/1f422.png` },

  { id: 'apple', name: '苹果', category: '美食', url: `${TW}/1f34e.png` },
  { id: 'banana', name: '香蕉', category: '美食', url: `${TW}/1f34c.png` },
  { id: 'rice', name: '米饭', category: '美食', url: `${TW}/1f35a.png` },
  { id: 'bento', name: '便当', category: '美食', url: `${TW}/1f371.png` },
  { id: 'noodles', name: '面条', category: '美食', url: `${TW}/1f35c.png` },
  { id: 'sushi', name: '寿司', category: '美食', url: `${TW}/1f363.png` },
  { id: 'cake', name: '蛋糕', category: '美食', url: `${TW}/1f370.png` },
  { id: 'milk', name: '牛奶', category: '美食', url: `${TW}/1f95b.png` },
  { id: 'cocktail', name: '鸡尾酒', category: '美食', url: `${TW}/1f378.png` },
  { id: 'wine', name: '红酒', category: '美食', url: `${TW}/1f377.png` },

  { id: 'pill', name: '药丸', category: '健康', url: `${TW}/1f48a.png` },
  { id: 'syringe', name: '注射器', category: '健康', url: `${TW}/1f489.png` },
  { id: 'thermometer', name: '体温计', category: '健康', url: `${TW}/1f321-fe0f.png` },
  { id: 'stethoscope', name: '听诊器', category: '健康', url: `${TW}/1fa7a.png` },
  { id: 'bandage', name: '创可贴', category: '健康', url: `${TW}/1fa79.png` },

  { id: 'calendar', name: '日历', category: '办公', url: `${TW}/1f4c5.png` },
  { id: 'clock', name: '时钟', category: '办公', url: `${TW}/1f570-fe0f.png` },
  { id: 'telephone', name: '电话', category: '办公', url: `${TW}/260e-fe0f.png` },
  { id: 'mailbox', name: '邮箱', category: '办公', url: `${TW}/1f4eb.png` },
  { id: 'file_folder', name: '文件夹', category: '办公', url: `${TW}/1f4c1.png` },

  { id: 'gift', name: '礼物', category: '其他', url: `${TW}/1f381.png` },
  { id: 'money', name: '投资', category: '其他', url: `${TW}/1f4b0.png` },
  { id: 'credit_card', name: '信用卡', category: '其他', url: `${TW}/1f4b3.png` },
  { id: 'chart', name: '图表', category: '其他', url: `${TW}/1f4c8.png` },
  { id: 'coffee', name: '咖啡', category: '其他', url: `${TW}/2615.png` },
  { id: 'tea', name: '茶杯', category: '其他', url: `${TW}/1f375.png` },
  { id: 'burger', name: '汉堡', category: '其他', url: `${TW}/1f354.png` },
  { id: 'pizza', name: '披萨', category: '其他', url: `${TW}/1f355.png` },
  { id: 'shopping_cart', name: '购物车', category: '其他', url: `${TW}/1f6d2.png` },
  { id: 'ticket', name: '票券', category: '其他', url: `${TW}/1f3ab.png` },
  { id: 'wrench', name: '扳手', category: '其他', url: `${TW}/1f527.png` },
  { id: 'hammer', name: '锤子', category: '其他', url: `${TW}/1f528.png` },
  { id: 'key', name: '钥匙', category: '其他', url: `${TW}/1f511.png` },
  { id: 'lock', name: '锁', category: '其他', url: `${TW}/1f512.png` },
  { id: 'candle', name: '蜡烛', category: '其他', url: `${TW}/1f56f-fe0f.png` }
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
