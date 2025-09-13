// popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
    // --- 頁面元素 ---
    const wrapper = document.querySelector('.popup-wrapper');
    const schedulePage = document.getElementById('schedule-page');
    const settingsPage = document.getElementById('settings-page');
    const goToSettingsBtn = document.getElementById('go-to-settings');
    const goToScheduleBtn = document.getElementById('go-to-schedule');
    
    // --- 設定區塊元素 ---
    const allowGeClashCheckbox = document.getElementById('allow-ge-clash');

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
    // 1. 載入並渲染課表
    chrome.storage.sync.get(['savedSchedule'], (result) => {
        if (result.savedSchedule && result.savedSchedule.length > 0) {
            renderSchedule(result.savedSchedule, scheduleContainer);
        } else {
            scheduleContainer.innerHTML = '<p class="no-schedule-msg">尚未儲存課表。請至清大選課結果頁面點擊「儲存課表」按鈕。</p>';
        }
    });

    // 2. 載入儲存的設定
    chrome.storage.sync.get(['allowGeClash'], (result) => {
        allowGeClashCheckbox.checked = result.allowGeClash;
    });

    // 3. 監聽設定變更並儲存
    allowGeClashCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ allowGeClash: allowGeClashCheckbox.checked });
    });

    // --- 【新增】框架比例設定邏輯 ---
    // 1. 載入儲存的比例設定
    chrome.storage.sync.get(['framesetRatio'], (result) => {
        // 如果有儲存過的值就套用，否則使用預設值 350
        ratioSlider.value = result.framesetRatio || 350;
    });

    // 2. 監聽「套用」按鈕點擊事件
    saveRatioBtn.addEventListener('click', () => {
        const newRatio = ratioSlider.value;
        // 儲存設定
        chrome.storage.sync.set({ 'framesetRatio': newRatio }, () => {
            alert('比例已儲存！');
        });

        // 發送訊息給 content script，要求立即更新頁面
        // 我們需要先找到當前的選課分頁
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

// 【渲染課表函數】
function renderSchedule(courses, container) {
    container.innerHTML = '';
    const scheduleWrapper = document.createElement('div');
    scheduleWrapper.className = 'schedule-wrapper';
    const timetableGrid = document.createElement('div');
    timetableGrid.className = 'timetable-grid';
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
    courses.forEach(course => {
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
                    courseBlock.className = `course-block ${course.isGe ? 'ge' : ''}`;
                    courseBlock.style.gridColumn = `${parseInt(day) + 1}`;
                    courseBlock.style.gridRow = `${startSlot + 1} / span ${endSlot - startSlot + 1}`;
                    courseBlock.title = `${course.name} (${course.id})`;
                    courseBlock.innerHTML = `<strong>${course.name}</strong><span>${course.id}</span>`;
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
}