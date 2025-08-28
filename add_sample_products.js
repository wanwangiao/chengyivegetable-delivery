const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.cywcuzgbuqmxjxwyrrsp:Chengyi2025%21Fresh@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
});

async function addProducts() {
  try {
    console.log('🛍️ 新增示範商品...');
    
    const products = [
      {
        name: '有機高麗菜',
        price: 45,
        unit: '斤',
        is_priced_item: true,
        description: '有機栽培，無農藥殘留，清脆甜美，適合炒食、煮湯',
        has_options: true,
        option_groups: {
          groups: [
            {
              group_id: 1,
              group_name: '規格選擇',
              group_type: 'single',
              required: true,
              options: [
                {option_id: 1, name: '小顆(約1斤)', price_modifier: 0, is_default: true, stock: 30},
                {option_id: 2, name: '中顆(約1.5斤)', price_modifier: 0, is_default: false, stock: 25},
                {option_id: 3, name: '大顆(約2斤)', price_modifier: 0, is_default: false, stock: 15}
              ]
            },
            {
              group_id: 2,
              group_name: '加購蔬菜包',
              group_type: 'multiple',
              required: false,
              options: [
                {option_id: 4, name: '有機胡蘿蔔 半斤', price_modifier: 35, is_default: false, stock: 20},
                {option_id: 5, name: '有機白蘿蔔 半斤', price_modifier: 30, is_default: false, stock: 18}
              ]
            }
          ]
        },
        category_id: 1,
        image_url: '🥬'
      },
      {
        name: '新鮮紅蘿蔔',
        price: 35,
        unit: '斤',
        is_priced_item: true,
        description: '橙紅飽滿，富含胡蘿蔔素，清甜爽脆，營養豐富',
        has_options: true,
        option_groups: {
          groups: [
            {
              group_id: 1,
              group_name: '重量選擇',
              group_type: 'single',
              required: true,
              options: [
                {option_id: 1, name: '半斤裝', price_modifier: -15, is_default: false, stock: 40},
                {option_id: 2, name: '一斤裝', price_modifier: 0, is_default: true, stock: 50},
                {option_id: 3, name: '兩斤裝', price_modifier: 0, is_default: false, stock: 25}
              ]
            }
          ]
        },
        category_id: 1,
        image_url: '🥕'
      },
      {
        name: '紐西蘭蜜蘋果',
        price: 120,
        unit: '盒',
        is_priced_item: false,
        description: '一天一蘋果，醫生遠離我！紐西蘭進口，香甜多汁',
        has_options: true,
        option_groups: {
          groups: [
            {
              group_id: 1,
              group_name: '包裝規格',
              group_type: 'single',
              required: true,
              options: [
                {option_id: 1, name: '3顆裝', price_modifier: 0, is_default: true, stock: 30},
                {option_id: 2, name: '5顆裝', price_modifier: 80, is_default: false, stock: 20},
                {option_id: 3, name: '10顆家庭裝', price_modifier: 180, is_default: false, stock: 15}
              ]
            }
          ]
        },
        category_id: 2,
        image_url: '🍎'
      },
      {
        name: '溫室牛番茄',
        price: 55,
        unit: '斤',
        is_priced_item: true,
        description: '溫室栽培，皮薄多汁，酸甜適中，富含茄紅素',
        has_options: true,
        option_groups: {
          groups: [
            {
              group_id: 1,
              group_name: '重量選擇',
              group_type: 'single',
              required: true,
              options: [
                {option_id: 1, name: '半斤裝(約3-4顆)', price_modifier: -25, is_default: false, stock: 35},
                {option_id: 2, name: '一斤裝(約6-8顆)', price_modifier: 0, is_default: true, stock: 45}
              ]
            }
          ]
        },
        category_id: 1,
        image_url: '🍅'
      },
      {
        name: '拉拉山桂竹筍',
        price: 140,
        unit: '斤',
        is_priced_item: true,
        description: '拉拉山當季限定！鮮嫩清甜，纖維細緻，適合涼拌、炒食',
        has_options: true,
        option_groups: {
          groups: [
            {
              group_id: 1,
              group_name: '數量選擇',
              group_type: 'single',
              required: true,
              options: [
                {option_id: 1, name: '2支裝', price_modifier: 0, is_default: false, stock: 20},
                {option_id: 2, name: '3支裝', price_modifier: 0, is_default: true, stock: 25},
                {option_id: 3, name: '5支裝', price_modifier: 0, is_default: false, stock: 15}
              ]
            },
            {
              group_id: 2,
              group_name: '料理建議加購',
              group_type: 'multiple',
              required: false,
              options: [
                {option_id: 4, name: '梅子粉調味包', price_modifier: 25, is_default: false, stock: 10},
                {option_id: 5, name: '芝麻醬包', price_modifier: 30, is_default: false, stock: 8}
              ]
            }
          ]
        },
        category_id: 1,
        image_url: '🎋'
      },
      {
        name: '有機杏鮑菇',
        price: 60,
        unit: '包',
        is_priced_item: false,
        description: '有機認證，肉質厚實，口感類似鮑魚，適合燒烤、炒食',
        has_options: true,
        option_groups: {
          groups: [
            {
              group_id: 1,
              group_name: '包裝規格',
              group_type: 'single',
              required: true,
              options: [
                {option_id: 1, name: '小包裝(約200g)', price_modifier: 0, is_default: true, stock: 40},
                {option_id: 2, name: '大包裝(約400g)', price_modifier: 40, is_default: false, stock: 25}
              ]
            }
          ]
        },
        category_id: 1,
        image_url: '🍄'
      }
    ];
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const result = await pool.query(`
        INSERT INTO products (name, price, unit_hint, is_priced_item, description, has_options, option_groups, category_id, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name
      `, [
        product.name,
        product.price,
        product.unit,
        product.is_priced_item,
        product.description,
        product.has_options,
        JSON.stringify(product.option_groups),
        product.category_id,
        product.image_url
      ]);
      
      console.log(`✅ 新增: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
    }
    
    // 驗證結果
    const count = await pool.query('SELECT COUNT(*) as count FROM products');
    const productList = await pool.query('SELECT id, name, price, has_options FROM products ORDER BY id');
    
    console.log(`\n📊 總商品數量: ${count.rows[0].count}`);
    console.log('🛍️ 商品列表:');
    productList.rows.forEach(p => {
      console.log(`  ${p.id}. ${p.name} - $${p.price} (選項:${p.has_options ? '是' : '否'})`);
    });
    
    await pool.end();
    console.log('\n🎉 示範商品新增完成！');
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

addProducts();