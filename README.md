清大選課小幫手 - 專案藍圖總覽
這份文件包含了「清大選課小幫手」Chrome 擴充功能的所有規劃、檔案結構與程式碼框架。

README.md
這是一個旨在改善國立清華大學網路選課系統使用者體驗的 Chrome 擴充功能。

功能特色
進階篩選器：

在「總錄」課程頁面 (JH713004.php) 上方新增篩選面板。

支援依 課程名稱 或 教師姓名 關鍵字即時篩選。

提供 7x14 的視覺化時間篩選器，使用者可點擊格子自訂篩選無衝堂的空閒時段。

智慧衝堂管理：

自動讀取「選課結果頁」(JH713005.php) 上的已選課程時間。

提供 「隱藏衝堂課程」 功能，一鍵過濾掉與現有課表衝突的課程。

包含 「允許通識課程衝堂」 的選項，在篩選時保留通識課的志願彈性。

課程評價快搜：

在每門課程的「科目名稱」和「教師」旁新增查詢按鈕。

點擊按鈕後可選擇在 Dcard 或 歐趴糖 上搜尋評價。

提供三種搜尋模式：「僅課名」、「僅教師名」、「課名+教師名」。

搜尋結果將在不離開選課頁面的 互動視窗(Modal) 中顯示。

輔助工具：

即時學分計數器：顯示當前篩選結果的總學分數，並可勾選課程來累加預計修課學分。

我的最愛：可將感興趣的課程加入收藏，方便跨系所比較。

個人化設定：

透過擴充功能的 Popup 頁面進行設定，例如永久保存「允許通識衝堂」的選項。

Popup 頁面也包含開發者支持連結和未來功能擴充的空間。

專案結構
本專案採用模組化設計，以確保程式碼的清晰度與可維護性。

manifest.json：擴充功能的設定檔，定義權限與執行的腳本。

/popup：存放擴充功能彈出視窗的相關檔案。

popup.html: 彈出視窗的介面。

popup.js: 彈出視窗的邏輯。

popup.css: 彈出視窗的樣式。

/scripts：注入到選課頁面的核心腳本。

content.js: 內容腳本進入點，負責協調其他模組。

ui.js: 負責建立並注入篩選器、按鈕等 UI 元素。

filter.js: 處理所有課程篩選的核心邏輯。

parser.js: 負責從 HTML 中解析課程資料與使用者課表。

modal.js: 負責建立與管理評價查詢的互動視窗。

/styles：注入到選課頁面的樣式檔案。

style.css: 篩選器、互動視窗等自訂 UI 的樣式。

/icons：存放擴充功能的圖示。

manifest.json
JSON

{
  "manifest_version": 3,
  "name": "清大選課小幫手",
  "version": "1.0",
  "description": "改善清華大學網路選課系統的體驗，提供進階篩選與評價查詢功能。",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://www.ccxp.nthu.edu.tw/ccxp/COURSE/JH/7/7.1/7.1.3/*"
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    }
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.ccxp.nthu.edu.tw/ccxp/COURSE/JH/7/7.1/7.1.3/JH713004.php*"
      ],
      "js": [
        "scripts/modal.js",
        "scripts/parser.js",
        "scripts/filter.js",
        "scripts/ui.js",
        "scripts/content.js"
      ],
      "css": [
        "styles/style.css"
      ]
    }
  ]
}
popup/popup.html
HTML

<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>清大選課小幫手設定</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>清大選課小幫手</h1>
      <p class="version">版本 1.0</p>
    </header>
    
    <main class="settings">
      <h2>功能設定</h2>
      <div class="setting-item">
        <label for="allow-ge-clash">允許通識課程衝堂</label>
        <input type="checkbox" id="allow-ge-clash" />
      </div>
      </main>

    <hr>

    <section class="support">
      <h2>支持開發者</h2>
      <p>如果這個工具對你有幫助，可以考慮<a href="YOUR_SUPPORT_LINK_HERE" target="_blank">請我喝杯咖啡</a>！</p>
    </section>
  </div>
  <script src="popup.js"></script>
</body>
</html>
popup/popup.js
JavaScript

// popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
  const allowGeClashCheckbox = document.getElementById('allow-ge-clash');

  // 載入儲存的設定
  chrome.storage.sync.get(['allowGeClash'], (result) => {
    allowGeClashCheckbox.checked = !!result.allowGeClash;
  });

  // 監聽設定變更並儲存
  allowGeClashCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ allowGeClash: allowGeClashCheckbox.checked });
  });
});
popup/popup.css
CSS

/* popup/popup.css */
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  width: 280px;
  background-color: #f9f9f9;
  color: #333;
}

.container {
  padding: 15px;
}

header {
  text-align: center;
  border-bottom: 1px solid #ddd;
  padding-bottom: 10px;
  margin-bottom: 15px;
}

h1 {
  font-size: 1.2em;
  margin: 0;
  color: #2c3e50;
}

.version {
  font-size: 0.8em;
  color: #7f8c8d;
}

.settings h2, .support h2 {
  font-size: 1em;
  color: #34495e;
  margin-top: 0;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.support p {
  font-size: 0.9em;
}

a {
  color: #3498db;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
scripts/content.js
JavaScript

// scripts/content.js
// 這是擴充功能的進入點 (Entry Point)

console.log("清大選課小幫手已啟動！");

// 頁面載入後執行的主函式
function main() {
    // 1. 注入 UI 介面
    const courseTable = document.getElementById('T1');
    if (!courseTable) {
        console.error("找不到課程表格 #T1");
        return;
    }
    const filterUI = NthuCourseHelperUI.createFilterUI();
    // 將篩選器UI插入到表格之前
    courseTable.parentNode.insertBefore(filterUI, courseTable);
    
    // 2. 解析課程資料並注入查詢按鈕
    const courses = NthuCourseParser.parseCourseTable(courseTable);
    NthuCourseHelperUI.injectSearchButtons(courseTable, courses);

    // 3. 綁定事件監聽器
    setupEventListeners(courses, courseTable);
}

// 設定所有事件監聽
function setupEventListeners(courses, table) {
    const nameFilter = document.getElementById('nthu-helper-filter-name');
    const teacherFilter = document.getElementById('nthu-helper-filter-teacher');
    const timeGrid = document.querySelector('.nthu-helper-time-grid');
    const hideClashCheckbox = document.getElementById('nthu-helper-hide-clash');
    
    // 課名和教師名稱篩選
    nameFilter.addEventListener('input', () => NthuCourseFilter.filterAll(table, courses));
    teacherFilter.addEventListener('input', () => NthuCourseFilter.filterAll(table, courses));

    // 時間格子點擊篩選
    timeGrid.addEventListener('click', (event) => {
        if (event.target.classList.contains('time-slot')) {
            event.target.classList.toggle('selected');
            NthuCourseFilter.filterAll(table, courses);
        }
    });
    
    // 隱藏衝堂課程
    hideClashCheckbox.addEventListener('change', () => NthuCourseFilter.filterAll(table, courses));
    
    // 監聽查詢按鈕的點擊事件 (使用事件委派)
    table.addEventListener('click', (event) => {
        const target = event.target.closest('.nthu-helper-search-btn');
        if (!target) return;

        const courseIndex = parseInt(target.dataset.index, 10);
        const course = courses[courseIndex];
        
        NthuCourseHelperUI.showSearchMenu(event.clientX, event.clientY, course);
    });
}

// 執行主函式
main();
scripts/ui.js
JavaScript

// scripts/ui.js
// 負責建立並注入所有 UI 元素

const NthuCourseHelperUI = {
    // 建立篩選器面板
    createFilterUI() {
        const container = document.createElement('div');
        container.className = 'nthu-helper-container';
        container.innerHTML = `
            <h2>清大選課小幫手篩選器</h2>
            <div class="filters">
                <input type="text" id="nthu-helper-filter-name" placeholder="篩選課程名稱...">
                <input type="text" id="nthu-helper-filter-teacher" placeholder="篩選教師姓名...">
                <div class="filter-options">
                  <label><input type="checkbox" id="nthu-helper-hide-clash"> 隱藏衝堂課程</label>
                </div>
            </div>
            <h3>自訂時間篩選</h3>
            <div class="nthu-helper-time-grid">${this.createTimeGrid()}</div>
        `;
        return container;
    },

    // 建立 7x14 的時間選擇格子
    createTimeGrid() {
        let gridHTML = '<div class="time-header"><div></div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div></div>';
        const slots = ['1', '2', '3', '4', 'n', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd'];
        slots.forEach(slot => {
            gridHTML += `<div class="time-row"><div class="time-label">${slot}</div>`;
            for (let day = 1; day <= 7; day++) {
                gridHTML += `<div class="time-slot" data-day="${day}" data-slot="${slot}"></div>`;
            }
            gridHTML += '</div>';
        });
        return gridHTML;
    },
    
    // 注入查詢按鈕到課程表格
    injectSearchButtons(table, courses) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            if (!courses[index]) return; // 如果該行沒有解析出課程資料，則跳過

            // 在科目名稱欄位新增按鈕
            const nameCell = row.cells[2];
            if (nameCell) {
                nameCell.style.position = 'relative';
                const searchBtn = this.createSearchButton(index);
                nameCell.appendChild(searchBtn);
            }
            
            // 在教師欄位新增按鈕
            const teacherCell = row.cells[6];
            if (teacherCell) {
                teacherCell.style.position = 'relative';
                const searchBtn = this.createSearchButton(index);
                teacherCell.appendChild(searchBtn);
            }
        });
    },
    
    // 建立單一查詢按鈕
    createSearchButton(index) {
        const button = document.createElement('button');
        button.className = 'nthu-helper-search-btn';
        button.innerHTML = '🔍';
        button.title = '查詢課程評價';
        button.dataset.index = index;
        return button;
    },
    
    // 顯示查詢選項菜單
    showSearchMenu(x, y, course) {
        // 移除已存在的菜單
        const existingMenu = document.getElementById('nthu-helper-search-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'nthu-helper-search-menu';
        
        const teacherName = course.teacher.split('<br>')[0]; // 只取第一位老師的名字

        menu.innerHTML = `
            <div class="menu-title">選擇搜尋方式</div>
            <ul>
                <li data-type="dcard" data-query="${course.name}">Dcard: 課程名</li>
                <li data-type="opass" data-query="${course.name}">歐趴糖: 課程名</li>
                <li data-type="dcard" data-query="${teacherName}">Dcard: 教師名</li>
                <li data-type="opass" data-query="${teacherName}">歐趴糖: 教師名</li>
                <li data-type="dcard" data-query="${course.name} ${teacherName}">Dcard: 課名+教師名</li>
                <li data-type="opass" data-query="${course.name} ${teacherName}">歐趴糖: 課名+教師名</li>
            </ul>
        `;
        
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        document.body.appendChild(menu);

        // 菜單點擊事件
        menu.addEventListener('click', (event) => {
            if (event.target.tagName === 'LI') {
                const type = event.target.dataset.type;
                const query = event.target.dataset.query;
                let url = '';
                if (type === 'dcard') {
                    url = `https://www.dcard.tw/search/posts?query=${encodeURIComponent('清大 ' + query)}`;
                } else {
                    url = `https://www.opass.app/search?q=${encodeURIComponent(query)}`;
                }
                NthuCourseModal.show(url);
                menu.remove();
            }
        });

        // 點擊菜單外部即可關閉
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 0);
    }
};
scripts/filter.js
JavaScript

// scripts/filter.js
// 處理所有篩選邏輯

const NthuCourseFilter = {
    
    // 主篩選函數，整合所有篩選條件
    filterAll(table, courses) {
        const nameQuery = document.getElementById('nthu-helper-filter-name').value.toLowerCase();
        const teacherQuery = document.getElementById('nthu-helper-filter-teacher').value.toLowerCase();
        const selectedTimes = this.getSelectedTimes();
        const hideClash = document.getElementById('nthu-helper-hide-clash').checked;

        // 從 storage 獲取通識衝堂設定
        chrome.storage.sync.get(['allowGeClash'], result => {
            const allowGeClash = !!result.allowGeClash;
            
            // TODO: 需要一個函數來異步獲取已選課程時間
            const existingSchedule = []; // 暫時為空，需從 JH713005.html 解析

            const rows = table.querySelectorAll('tbody tr');
            rows.forEach((row, index) => {
                const course = courses[index];
                if (!course) return;

                const nameMatch = course.name.toLowerCase().includes(nameQuery);
                const teacherMatch = course.teacher.toLowerCase().includes(teacherQuery);
                const timeMatch = this.checkTimeMatch(course.time, selectedTimes);
                const clashMatch = hideClash ? !this.isClashing(course, existingSchedule, allowGeClash) : true;

                if (nameMatch && teacherMatch && timeMatch && clashMatch) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    },

    // 獲取使用者在時間格子上選擇的時間
    getSelectedTimes() {
        const selectedSlots = document.querySelectorAll('.nthu-helper-time-grid .time-slot.selected');
        if (selectedSlots.length === 0) return null; // 如果沒有選擇，則不進行時間篩選
        
        const times = [];
        selectedSlots.forEach(slot => {
            times.push({ day: slot.dataset.day, slot: slot.dataset.slot });
        });
        return times;
    },

    // 檢查課程時間是否符合篩選
    checkTimeMatch(courseTime, selectedTimes) {
        if (!selectedTimes) return true; // 沒有選擇時間，則所有課程都符合
        if (!courseTime) return false; // 課程沒有時間，則不符合
        
        // TODO: 需要一個解析 courseTime (如 "M7M8R6") 的輔助函數
        const courseSlots = NthuCourseParser.parseTimeCode(courseTime); // 假設有這個解析函數
        
        // 只要課程時間中有一個時段符合使用者選擇的任一時段即可
        for (const selected of selectedTimes) {
            for (const course of courseSlots) {
                if (selected.day == course.day && selected.slot == course.slot) {
                    return true;
                }
            }
        }
        return false;
    },

    // 檢查課程是否與現有課表衝堂
    isClashing(course, schedule, allowGeClash) {
        if (allowGeClash && course.id.includes('GE')) {
            return false; // 如果允許通識衝堂且此課為通識，則不算衝堂
        }
        
        const courseSlots = NthuCourseParser.parseTimeCode(course.time);
        
        for (const existing of schedule) {
            for (const courseSlot of courseSlots) {
                // TODO: 需要更詳細的衝堂比對邏輯
                if (existing.day == courseSlot.day && existing.slot == courseSlot.slot) {
                    return true; // 發現衝堂
                }
            }
        }
        return false;
    }
};
scripts/parser.js
JavaScript

// scripts/parser.js
// 負責從 HTML 頁面解析資料

const NthuCourseParser = {
    // 解析課程總表
    parseCourseTable(table) {
        const courses = [];
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (row.cells.length < 13) return; // 確保是有效的課程行

            const course = {
                id: row.cells[1].innerText.trim(),
                name: row.cells[2].innerText.split('\n')[0].trim(),
                nameEn: row.cells[2].innerText.split('\n')[1]?.trim() || '',
                credit: row.cells[3].innerText.trim(),
                time: row.cells[4].innerText.trim(),
                room: row.cells[5].innerText.trim(),
                teacher: row.cells[6].innerText.trim(),
                // ... 可以繼續解析更多欄位
            };
            courses.push(course);
        });
        return courses;
    },

    // TODO: 解析時間代碼 (e.g., "M7M8R6")
    parseTimeCode(timeCode) {
        // 這是一個簡化的範例，實際需要更完整的邏輯
        // M=週一, T=週二, W=週三, R=週四, F=週五, S=週六
        const mapping = { 'M': 1, 'T': 2, 'W': 3, 'R': 4, 'F': 5, 'S': 6, 'U': 7 };
        const slots = [];
        const regex = /([MTWRFSU])([1-9a-dn])/g;
        let match;
        while ((match = regex.exec(timeCode)) !== null) {
            slots.push({ day: mapping[match[1]], slot: match[2] });
        }
        return slots;
    },

    // TODO: 解析選課結果頁面的課表 (JH713005.html)
    parseSchedulePage(htmlContent) {
        // 此函數需要能夠接收 JH713005.html 的內容
        // 然後解析其中的課表，返回一個類似 parseTimeCode 結果的陣列
        // 這部分需要透過 background script 或其他方式獲取頁面內容
        return [];
    }
};
scripts/modal.js
JavaScript

// scripts/modal.js
// 負責建立與管理互動視窗

const NthuCourseModal = {
    show(url) {
        // 移除舊的 modal
        this.close();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'nthu-helper-modal-overlay';

        const modalContent = document.createElement('div');
        modalContent.id = 'nthu-helper-modal-content';
        modalContent.innerHTML = `
            <button id="nthu-helper-modal-close">&times;</button>
            <iframe src="${url}"></iframe>
        `;

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        // 綁定關閉事件
        document.getElementById('nthu-helper-modal-close').addEventListener('click', this.close);
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                this.close();
            }
        });
    },

    close() {
        const modalOverlay = document.getElementById('nthu-helper-modal-overlay');
        if (modalOverlay) {
            modalOverlay.remove();
        }
    }
};
styles/style.css
CSS

/* styles/style.css */

/* --- 篩選器面板 --- */
.nthu-helper-container {
  background-color: #fff;
  border: 2px solid #658487;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 8px;
}
.nthu-helper-container h2, .nthu-helper-container h3 {
  color: #3d32a0;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}
.filters {
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 15px;
}
.filters input[type="text"] {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* --- 時間選擇格子 --- */
.nthu-helper-time-grid {
  display: grid;
  grid-template-columns: 30px repeat(7, 1fr);
  gap: 2px;
}
.time-header div, .time-label {
  text-align: center;
  font-weight: bold;
}
.time-row {
  display: contents;
}
.time-slot {
  height: 25px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: background-color 0.2s;
}
.time-slot:hover {
  background-color: #e0e0e0;
}
.time-slot.selected {
  background-color: #3498db;
  border-color: #2980b9;
}

/* --- 查詢按鈕 --- */
.nthu-helper-search-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  width: 20px;
  height: 20px;
  line-height: 18px;
  text-align: center;
  opacity: 0.5;
  transition: opacity 0.2s;
}
td:hover .nthu-helper-search-btn {
  opacity: 1;
}

/* --- 查詢菜單 --- */
#nthu-helper-search-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  z-index: 9999;
  border-radius: 4px;
}
#nthu-helper-search-menu .menu-title {
  padding: 8px 12px;
  font-weight: bold;
  background-color: #f5f5f5;
}
#nthu-helper-search-menu ul {
  list-style: none;
  margin: 0;
  padding: 5px 0;
}
#nthu-helper-search-menu li {
  padding: 8px 15px;
  cursor: pointer;
}
#nthu-helper-search-menu li:hover {
  background-color: #3498db;
  color: white;
}

/* --- 互動視窗 (Modal) --- */
#nthu-helper-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
}
#nthu-helper-modal-content {
  background: #fff;
  width: 80%;
  height: 80%;
  border-radius: 8px;
  position: relative;
  display: flex;
  flex-direction: column;
}
#nthu-helper-modal-close {
  position: absolute;
  top: -15px;
  right: -15px;
  background: white;
  border: 2px solid black;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 20px;
  cursor: pointer;
}
#nthu-helper-modal-content iframe {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 8px;
}