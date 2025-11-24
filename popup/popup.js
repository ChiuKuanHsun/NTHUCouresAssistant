// popup/popup.js

// --- 【新增】清大節次時間表 (用於判斷目前時間) ---
const nthuTimeSlots = [
    { code: '1', start: '08:00', end: '08:50' },
    { code: '2', start: '09:00', end: '09:50' },
    { code: '3', start: '10:10', end: '11:00' },
    { code: '4', start: '11:10', end: '12:00' },
    { code: 'n', start: '12:10', end: '13:00' },
    { code: '5', start: '13:20', end: '14:10' },
    { code: '6', start: '14:20', end: '15:10' },
    { code: '7', start: '15:30', end: '16:20' },
    { code: '8', start: '16:30', end: '17:20' },
    { code: '9', start: '17:30', end: '18:20' },
    { code: 'a', start: '18:30', end: '19:20' },
    { code: 'b', start: '19:30', end: '20:20' },
    { code: 'c', start: '20:30', end: '21:20' },
    { code: 'd', start: '21:30', end: '22:20' }
];

// --- 【新增】配色主題色票 ---
const colorPalettes = {
    'default': null, 
    'pastel': [
        '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', 
        '#F6EAC2', '#FF9AA2', '#D5AAFF', '#85E3FF', '#B9F6CA'
    ],
    'vibrant': [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', 
        '#F7DC6F', '#BB8FCE', '#F1948A', '#54A0FF', '#ad5ec5ff'
    ],
    'morandi': [
        '#7A7281', '#A29BFE', '#B2BABB', '#95A5A6', '#D7BDE2', 
        '#A3E4D7', '#FAD7A0', '#EDBB99', '#84817a', '#d1ccc0'
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    // --- 頁面元素 ---
    const wrapper = document.querySelector('.popup-wrapper');
    const schedulePage = document.getElementById('schedule-page');
    const settingsPage = document.getElementById('settings-page');
    const goToSettingsBtn = document.getElementById('go-to-settings');
    const goToScheduleBtn = document.getElementById('go-to-schedule');
    
    // --- 設定區塊元素 ---
    const allowGeClashCheckbox = document.getElementById('allow-ge-clash');
    const colorThemeSelect = document.getElementById('color-theme'); // 新增

    // --- 框架比例設定元素 ---
    const ratioSlider = document.getElementById('frameset-ratio');
    const saveRatioBtn = document.getElementById('save-ratio-btn');
    
    // --- 課表區塊元素 ---
    const scheduleContainer = document.getElementById('schedule-container');

    // --- 頁面切換邏輯 ---
    goToSettingsBtn.addEventListener('click', () => {
        schedulePage.classList.remove('active');
        settingsPage.classList.add('active');
    });

    goToScheduleBtn.addEventListener('click', () => {
        settingsPage.classList.remove('active');
        schedulePage.classList.add('active');
        // 返回課表頁時，重新渲染以套用可能變更的設定
        loadAndRenderSchedule();
    });

    const toggleWeekendBtn = document.getElementById('toggle-weekend-btn');
    toggleWeekendBtn.addEventListener('click', () => {
        const wrapper = document.querySelector('.schedule-wrapper');
        if (wrapper) {
            wrapper.classList.toggle('weekend-visible');
            const isVisible = wrapper.classList.contains('weekend-visible');
            toggleWeekendBtn.textContent = isVisible ? '隱藏週末' : '顯示週末';
        }
    });

    // --- 功能邏輯 ---
    // 封裝載入與渲染邏輯，方便重用
    function loadAndRenderSchedule() {
        chrome.storage.sync.get(['savedSchedule', 'colorTheme'], (result) => {
            const theme = result.colorTheme || 'default';
            if (result.savedSchedule && result.savedSchedule.length > 0) {
                renderSchedule(result.savedSchedule, scheduleContainer, theme);
                // 渲染後立即檢查時間並高亮
                highlightCurrentTime();
            } else {
                scheduleContainer.innerHTML = '<p class="no-schedule-msg">尚未儲存課表。請至清大選課結果頁面點擊「儲存課表」按鈕。</p>';
            }
        });
    }

    // 1. 初始載入
    loadAndRenderSchedule();

    // 2. 載入儲存的設定
    chrome.storage.sync.get(['allowGeClash', 'colorTheme', 'framesetRatio'], (result) => {
        allowGeClashCheckbox.checked = result.allowGeClash || false;
        colorThemeSelect.value = result.colorTheme || 'default'; // 載入顏色設定
        ratioSlider.value = result.framesetRatio || 350;
    });

    // 3. 監聽設定變更並儲存
    allowGeClashCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ allowGeClash: allowGeClashCheckbox.checked });
    });

    // 【新增】監聽顏色主題變更
    colorThemeSelect.addEventListener('change', () => {
        chrome.storage.sync.set({ colorTheme: colorThemeSelect.value });
    });

    // ... (保留原本的 framesetRatio 邏輯) ...
    saveRatioBtn.addEventListener('click', () => {
        const newRatio = ratioSlider.value;
        chrome.storage.sync.set({ 'framesetRatio': newRatio }, () => {
            alert('比例已儲存！');
        });
        chrome.tabs.query({ url: "*://www.ccxp.nthu.edu.tw/ccxp/COURSE/JH/7/7.1/7.1.3/JH713003.php*" }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateFramesetRatio",
                    ratio: newRatio
                });
            } else {
                alert('找不到選課頁面分頁。此設定將在您下次開啟選課頁面時生效。');
            }
        });
    });

    // 【新增】啟動定時器，每分鐘檢查一次目前時間
    setInterval(highlightCurrentTime, 60000);
});

// 【輔助函數】將選課系統的節次代碼轉換為 CSS Grid 的行號
function timeSlotToGridRow(slotCode) {
    const slotMap = {
        '1': 1, '2': 2, '3': 3, '4': 4, 'n': 5,
        '5': 6, '6': 7, '7': 8, '8': 9, '9': 10,
        'a': 11, 'b': 12, 'c': 13, 'd': 14
    };
    return slotMap[slotCode] || 0;
}

// 【新增】判斷並高亮目前時間的格子
function highlightCurrentTime() {
    const courseLayer = document.querySelector('.course-layer');
    if (!courseLayer) return;

    // 1. 取得或建立「上課中 Overlay」
    let overlay = document.getElementById('current-time-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'current-time-overlay';
        overlay.className = 'current-time-overlay';
        courseLayer.appendChild(overlay);
    }

    // 2. 取得或建立「下課時間 Indicator」
    let breakIndicator = document.getElementById('break-time-indicator');
    if (!breakIndicator) {
        breakIndicator = document.createElement('div');
        breakIndicator.id = 'break-time-indicator';
        breakIndicator.className = 'break-time-indicator';
        breakIndicator.innerHTML = '<span>下課時間</span>';
        courseLayer.appendChild(breakIndicator);
    }

    const now = new Date();
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    
    // Grid Column 計算: 週一(1)是 Grid第2欄 ... 週日(0)是 Grid第8欄
    const gridCol = (day === 0) ? 8 : day + 1;

    // 【修正】確保時間格式為 HH:MM (補零)，避免格式錯誤導致比對失效
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    // 狀態變數
    let isClassTime = false;
    let isBreakTime = false;
    let currentSlotGridRow = 0;
    let breakAfterGridRow = 0; 

    // --- 邏輯判斷 ---
    
    // A. 檢查是否在上課時段內
    for (const slot of nthuTimeSlots) {
        if (currentTimeStr >= slot.start && currentTimeStr <= slot.end) {
            currentSlotGridRow = timeSlotToGridRow(slot.code) + 1; // +1 因為標題列
            isClassTime = true;
            break;
        }
    }

    // B. 如果不是上課中，檢查是否是「下課時間」(介於兩節課之間)
    if (!isClassTime) {
        // 遍歷所有節次之間的空檔
        for (let i = 0; i < nthuTimeSlots.length - 1; i++) {
            const currentSlot = nthuTimeSlots[i];
            const nextSlot = nthuTimeSlots[i+1];
            
            // 如果現在時間 > 這節結束 且 < 下節開始
            if (currentTimeStr > currentSlot.end && currentTimeStr < nextSlot.start) {
                isBreakTime = true;
                // 定位在「剛結束的這節課」的 Grid Row 底部
                breakAfterGridRow = timeSlotToGridRow(currentSlot.code) + 1;
                break;
            }
        }
    }

    // --- 更新 UI 顯示 ---

    // 1. 設定上課 Overlay
    if (isClassTime && currentSlotGridRow > 1) {
        overlay.style.display = 'block';
        overlay.style.gridColumn = gridCol; // 限制在當天
        overlay.style.gridRow = currentSlotGridRow;
    } else {
        overlay.style.display = 'none';
    }

    // 2. 設定下課 Indicator
    if (isBreakTime && breakAfterGridRow > 1) {
        breakIndicator.style.display = 'flex';
        
        // 【關鍵】明確指定 grid-column，配合 CSS 的 left:0; right:0; 限制寬度
        breakIndicator.style.gridColumn = gridCol; 
        
        // 放在上一節課的格子裡
        breakIndicator.style.gridRow = breakAfterGridRow;
        // 靠下對齊
        breakIndicator.style.alignSelf = 'end'; 
        // 往下推 50% 線寬，讓它看起來壓在分隔線上
        breakIndicator.style.transform = 'translateY(50%)'; 
    } else {
        breakIndicator.style.display = 'none';
    }
}

// 【渲染課表函數】(已修改支援主題色與資料屬性)
function renderSchedule(courses, container, theme = 'default') {
    container.innerHTML = '';
    const scheduleWrapper = document.createElement('div');
    scheduleWrapper.className = 'schedule-wrapper';
    
    const toggleBtn = document.getElementById('toggle-weekend-btn');
    if (toggleBtn && toggleBtn.textContent === '隱藏週末') {
        scheduleWrapper.classList.add('weekend-visible');
    }

    const timetableGrid = document.createElement('div');
    timetableGrid.className = 'timetable-grid';
    
    // ... (產生 gridHTML 的部分保持不變) ...
    let gridHTML = '<div class="grid-cell empty-corner"></div>';
    const daysOfWeek = ['一', '二', '三', '四', '五', '六', '日'];
    daysOfWeek.forEach(day => gridHTML += `<div class="grid-cell day-label">${day}</div>`);
    const timeLabels = ['1', '2', '3', '4', 'n', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd'];
    timeLabels.forEach(slotCode => {
        gridHTML += `<div class="grid-cell time-label-vertical">${slotCode}</div>`;
        for (let i = 0; i < 7; i++) {
            gridHTML += `<div class="grid-cell time-slot-background"></div>`;
        }
    });
    timetableGrid.innerHTML = gridHTML;
    
    const courseLayer = document.createElement('div');
    courseLayer.className = 'course-layer';
    
    // --- 【核心修改】顏色分配邏輯 ---
    // 建立一個 Map 來記錄 "課程名稱 -> 顏色" 的對應
    const courseColorMap = new Map();
    let paletteIndex = 0; // 用來記錄目前用到色票的第幾個顏色

    courses.forEach(course => {
        // 1. 決定顏色
        let customColor = null;
        if (theme !== 'default' && colorPalettes[theme]) {
            const palette = colorPalettes[theme];
            
            if (courseColorMap.has(course.name)) {
                // 如果這堂課名已經分配過顏色，就用一樣的
                customColor = courseColorMap.get(course.name);
            } else {
                // 如果是新課名，分配下一個顏色
                customColor = palette[paletteIndex % palette.length];
                courseColorMap.set(course.name, customColor);
                paletteIndex++; // 只有遇到新課名才推進索引
            }
        }

        // 2. 計算節次位置 (與之前相同)
        const courseTimeSlots = {};
        course.time.forEach(t => {
            if (!courseTimeSlots[t.day]) courseTimeSlots[t.day] = [];
            const gridRow = timeSlotToGridRow(t.slot);
            if (gridRow > 0) courseTimeSlots[t.day].push(gridRow);
        });
        
        for (const day in courseTimeSlots) {
            const slotsInDay = courseTimeSlots[day].sort((a, b) => a - b);
            if (slotsInDay.length === 0) continue;
            
            let startSlot = slotsInDay[0];
            for (let i = 0; i < slotsInDay.length; i++) {
                if (i === slotsInDay.length - 1 || slotsInDay[i + 1] !== slotsInDay[i] + 1) {
                    const endSlot = slotsInDay[i];
                    const courseBlock = document.createElement('div');
                    
                    courseBlock.className = `course-block ${(!customColor && course.isGe) ? 'ge' : ''}`;
                    courseBlock.style.gridColumn = `${parseInt(day) + 1}`;
                    courseBlock.style.gridRow = `${startSlot + 1} / span ${endSlot - startSlot + 1}`;
                    courseBlock.title = `${course.name} (${course.id})`;
                    
                    if (customColor) {
                        courseBlock.style.backgroundColor = customColor;
                        courseBlock.style.borderColor = adjustColor(customColor, -20);
                        courseBlock.style.color = '#333'; 
                    }

                    // 確保文字顏色在淺色背景上清晰
                    const textColorStyle = customColor ? 'color:#333' : '';
                    const subTextColorStyle = customColor ? 'color:rgba(0,0,0,0.6)' : '';

                    courseBlock.innerHTML = `<strong style="${textColorStyle}">${course.name}</strong><span style="${subTextColorStyle}">${course.id}</span>`;
                    
                    courseLayer.appendChild(courseBlock);
                    
                    if (i + 1 < slotsInDay.length) {
                        startSlot = slotsInDay[i + 1];
                    }
                }
            }
        }
    });
    
    scheduleWrapper.appendChild(timetableGrid);
    scheduleWrapper.appendChild(courseLayer);
    container.appendChild(scheduleWrapper);
    
    // 渲染完畢後，立即檢查一次時間高亮 (因為 DOM 剛建立)
    highlightCurrentTime();
}

// 【輔助】調整顏色亮度 (用於邊框)
function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}