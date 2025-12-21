// scripts/content.js
// 這是擴充功能的進入點 (Entry Point)

function applyFramesetRatio(ratio) {
    // 確保我們在最外層的 frameset 頁面
    const frameset = document.querySelector('frameset');
    if (frameset) {
        frameset.rows = `${ratio},*`;
    }
}

// 【新增】監聽來自 popup 的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateFramesetRatio") {
        applyFramesetRatio(request.ratio);
        sendResponse({ status: "success" }); // 回覆 popup，表示已處理
    }
    return true; // 保持 message channel 開啟以異步回覆
});
let savedCourses = [];

function updateSavedListButton() {
    const btn = document.getElementById('nthu-helper-saved-list-btn');
    if (!btn) return;
    const countBadge = btn.querySelector('.count-badge');
    const spinnerWrapper = btn.querySelector('.spinner-wrapper');
    const count = savedCourses.length;
    countBadge.textContent = count;
    if (count > 0) {
        btn.classList.add('active');
        countBadge.style.display = 'flex';
        if (!spinnerWrapper.innerHTML) spinnerWrapper.innerHTML = `<div class="spinner"></div>`;
    } else {
        btn.classList.remove('active');
        countBadge.style.display = 'none';
        spinnerWrapper.innerHTML = '';
    }
}

function openSavedCoursesModal(buttonRect) {
   const handleRemoveCourse = (indexToRemove) => {
        // 移除所有課程
        if (indexToRemove === -1) {
            savedCourses = [];
            chrome.storage.sync.set({ 'savedCourses': [] }, () => {
                console.log('所有課程已從暫存移除');
                updateSavedListButton();
                const courseTable = document.getElementById('T1');
                if (courseTable) {
                    const rows = courseTable.querySelectorAll('tbody tr');
                    rows.forEach((row, index) => {
                        const bookmarkCheckbox = row.querySelector(`#nthu-helper-bookmark-${index}`);
                        if (bookmarkCheckbox) {
                            bookmarkCheckbox.checked = false;
                        }
                    });
                }
                // 直接關閉 modal
                NthuCourseModal.close();
            });
            return;
        }
        const courseToRemove = savedCourses[indexToRemove];
        if (!courseToRemove) return;

        // 從 JS 陣列中移除
        savedCourses.splice(indexToRemove, 1);
        
        // 更新 storage
        chrome.storage.sync.set({ 'savedCourses': savedCourses }, () => {
            console.log('課程已從暫存移除');
            
            // 更新浮動按鈕
            updateSavedListButton();
            
            // --- 【核心 Bug 修正】---
            // 在主頁面上找到對應的書籤並手動取消勾選
            const courseTable = document.getElementById('T1');
            if (courseTable) {
                 const rows = courseTable.querySelectorAll('tbody tr');
                 rows.forEach((row, rowIndex) => {
                    const idCell = row.cells[1];
                    if (idCell && idCell.innerText.trim() === courseToRemove.id) {
                        const bookmarkCheckbox = row.querySelector(`#nthu-helper-bookmark-${rowIndex}`);
                        if (bookmarkCheckbox) bookmarkCheckbox.checked = false;
                    }
                 });
            }

            // --- 【新增】直接操作 DOM 移除 modal 中的對應行，而不是重新打開 ---
            const modalBody = document.querySelector('.saved-courses-modal .modal-body tbody');
            if (modalBody) {
                const rowToRemove = modalBody.querySelector(`tr[data-course-id="${courseToRemove.id}"]`);
                if (rowToRemove) {
                    rowToRemove.remove(); // 直接移除該行
                }
                // 如果移除後清單為空，顯示提示訊息
                if (savedCourses.length === 0) {
                    modalBody.innerHTML = '<tr><td colspan="8" class="no-saved-courses">尚未暫存任何課程</td></tr>';
                }
            }
        });
    };

    // 呼叫 modal.js 的函數來顯示視窗
    NthuCourseModal.showSavedCoursesModal(savedCourses, handleRemoveCourse, buttonRect);
    const modalContent = document.getElementById('nthu-helper-modal-content');
    if (modalContent) {
        modalContent.addEventListener('click', (event) => {
            const target = event.target;
            const action = target.dataset.action;
            const index = parseInt(target.dataset.index, 10);
            const course = savedCourses[index];

            if (!action || !course) return;

            if (action === 'add' && course.addActionArgs) {
                if (course.isGeInput) {
                    const priorityInput = target.parentElement.querySelector(`.ge-priority-input[data-course-index="${index}"]`);
                    // 需要在執行前，將志願序的值設定到主頁面的 form 中
                    document.form1.aspr.value = priorityInput ? priorityInput.value : '';
                }
                executeInPageContext('checks', course.addActionArgs);
            } else if (action === 'syllabus' && course.syllabusActionArgs) {
                executeInPageContext('syllabus', course.syllabusActionArgs);
            }
        });
    }
}
function executeInPageContext(functionName, argsArray) {
    window.postMessage({
        type: "EXECUTE_ACTION",
        payload: {
            functionName: functionName,
            args: argsArray
        }
    }, "*");
}

// 頁面載入後執行的主函式
async function main() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('scripts/execute.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();


    const data = await chrome.storage.sync.get('savedCourses');
    savedCourses = data.savedCourses || [];
    if (window.location.href.includes('JH713003.php') || window.location.href.includes('JH761003.php')) {
        chrome.storage.sync.get(['framesetRatio'], (result) => {
            if (result.framesetRatio) {
                applyFramesetRatio(result.framesetRatio);
            }
        });
    }
    // 檢查這是否是「加選」的那個表格
    const deptSelect = document.querySelector('select[name="new_dept"]');
    if (!deptSelect) {
        return;
    }
    const courseTable = document.getElementById('T1');
    if (!courseTable) {
        return;
    }
    
    NthuCourseHelperUI.makeSelectSearchable(deptSelect);

    const classSelect = document.querySelector('select[name="new_class"]');
    if (classSelect) {
        NthuCourseHelperUI.makeSelectSearchable(classSelect);
    }
    
    

    // 1. 注入 UI 介面
    const selectedDept = deptSelect.value;
    const isGePage = selectedDept.includes('GE');
    const filterUI = NthuCourseHelperUI.createFilterUI(isGePage);
    courseTable.parentNode.insertBefore(filterUI, courseTable);
    
    NthuCourseHelperUI.injectLiveCountColumn(courseTable);

    // 2. 解析可加選課程
    const courses = NthuCourseParser.parseCourseTable(courseTable);
    NthuCourseHelperUI.injectSearchButtons(courseTable, courses);

    // 3. 注入回到最上方按鈕
    const backToTopButton = NthuCourseHelperUI.createBackToTopButton();
    document.body.appendChild(backToTopButton);
    // 4. 注入暫存清單按鈕
    NthuCourseHelperUI.injectBookmarkButtons(courseTable, savedCourses);

    const savedListButton = NthuCourseHelperUI.createSavedListButton();
    document.body.appendChild(savedListButton);
    updateSavedListButton();
    // 5. 設定事件監聽器
    setupEventListeners(courses, courseTable, backToTopButton);
    
    
    /*
    const form = document.querySelector('form[name="form1"]');
    if (!form) return;
    const mainFrame = window.parent.frames['mainFrame'];
    const saveButton = NthuCourseHelperUI.createSaveScheduleButton();
    form.insertBefore(saveButton, form.firstChild); // 將按鈕加到頁面最上方

    // 為儲存按鈕特別綁定事件
    saveButton.addEventListener('click', () => {
        const enrolledCourses = NthuCourseParser.parseEnrolledCourses(mainFrame.document);
        chrome.storage.sync.set({ 'savedSchedule': enrolledCourses }, () => {
            alert('課表已成功儲存！');
            saveButton.textContent = '課表已儲存';
            saveButton.disabled = true;
        });
    });
    */
    
}

// 設定所有事件監聽
function setupEventListeners(courses, table, backToTopButton) {
    const nameFilter = document.getElementById('nthu-helper-filter-name');
    const teacherFilter = document.getElementById('nthu-helper-filter-teacher');
    const courseNoFilter = document.getElementById('nthu-helper-filter-courseNo');
    const timeGrid = document.querySelector('.nthu-helper-time-grid');
    const hideClashCheckbox = document.getElementById('nthu-helper-hide-clash');
    const toggleBtn = document.getElementById('nthu-helper-toggle-btn');
    const container = document.querySelector('.nthu-helper-container');
    const timeGridContainer = document.querySelector('.time-grid-container');
    const timeGridToggleBtn = document.getElementById('nthu-helper-toggle-time-grid-btn');
    const allowGeClashCheckbox = document.getElementById('nthu-helper-allow-ge-clash');
    const strictFilterCheckbox = document.getElementById('nthu-helper-strict-filter');
    const allowXClassClashCheckbox = document.getElementById('nthu-helper-allow-xclass-clash');
    const refreshBtn = document.getElementById('nthu-helper-refresh-counts-btn');
    const saveBtn = document.getElementById('nthu-helper-save-schedule-btn');
    const openTempListBtn = document.getElementById('nthu-helper-open-temp-list-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.textContent = '更新中...';
            refreshBtn.disabled = true;

            // 顯示所有課程的 loading spinner
            document.querySelectorAll('.live-count-cell').forEach(cell => {
                cell.innerHTML = `<div class="spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>`;
            });

            // 取得目前頁面的系所代碼
            const deptSelect = document.querySelector('select[name="new_dept"]');
            const departmentId = deptSelect.value.trim();

            const countsMap = await NthuCourseParser.fetchAndParseCounts(departmentId);

            // 更新頁面上的數字
            countsMap.forEach((data, courseId) => {
                const cell = document.getElementById(`count-${courseId}`);
                if (cell) {
                    cell.innerHTML = `${data.enrolled} / ${data.waiting}`;
                }
            });

            // 將沒有抓到資料的欄位恢復預設
            document.querySelectorAll('.live-count-cell').forEach(cell => {
                if (cell.innerHTML.includes('spinner')) {
                    cell.innerHTML = 'N/A';
                }
            });

            refreshBtn.textContent = '更新即時人數';
            refreshBtn.disabled = false;
        });
    }
    // 統一的篩選觸發函數
    const runFilter = () => {
        const mainFrame = window.parent.frames['mainFrame'];
        let enrolledSchedule = [];
        if (mainFrame && mainFrame.document) {
            enrolledSchedule = NthuCourseParser.parseEnrolledCourses(mainFrame.document);
        } else {
            console.error("找不到 mainFrame，無法讀取已選課程進行衝堂判斷。");
        }
        NthuCourseFilter.filterAll(table, courses, enrolledSchedule);
    };

    // --- 主要篩選器的事件 --- 
    saveBtn.addEventListener('click', () => {
        const mainFrame = window.parent.frames['mainFrame'];
        const enrolledCourses = NthuCourseParser.parseEnrolledCourses(mainFrame.document);
        chrome.storage.sync.set({ 'savedSchedule': enrolledCourses }, () => {
            alert('課表已成功儲存！');
            saveBtn.textContent = '課表已儲存';
            saveBtn.disabled = true;
        });
    });
    openTempListBtn.addEventListener('click', () => {
        openSavedCoursesModal();
    });
    toggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        container.classList.toggle('collapsed');
        toggleBtn.textContent = container.classList.contains('collapsed') ? '展開' : '收合';
    });
    nameFilter.addEventListener('input', runFilter);
    teacherFilter.addEventListener('input', runFilter);
    courseNoFilter.addEventListener('input', runFilter);
    hideClashCheckbox.addEventListener('change', runFilter);
    if (allowGeClashCheckbox) {
        allowGeClashCheckbox.addEventListener('change', runFilter);
    }
    if (allowXClassClashCheckbox) {
        allowXClassClashCheckbox.addEventListener('change', runFilter);
    }
    if (strictFilterCheckbox) {
        strictFilterCheckbox.addEventListener('change', runFilter);
    }
    
    // --- 通識類別篩選器的事件 ---
    const geCategoryOptions = document.querySelector('.ge-category-options');

    if (geCategoryOptions) {
        geCategoryOptions.addEventListener('change', (event) => {
            if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') {
                runFilter();
            }
        });
    }

    // --- 時間篩選器的事件 ---
    if (timeGridToggleBtn && timeGridContainer) {
        timeGridToggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            const isCollapsed = timeGridContainer.classList.toggle('collapsed');
            timeGridToggleBtn.textContent = isCollapsed ? '展開' : '收合';

            if (!isCollapsed) {
                const mainFrame = window.parent.frames['mainFrame'];
                if (mainFrame && mainFrame.document) {
                    const enrolledSchedule = NthuCourseParser.parseEnrolledCourses(mainFrame.document);
                    NthuCourseHelperUI.updateTimeGridHighlights(enrolledSchedule);
                }
            }
        });
    }
    timeGrid.addEventListener('click', (event) => {
        if (event.target.classList.contains('time-slot')) {
            event.target.classList.toggle('selected');
            runFilter();
        }
    });

    // --- 課程列表的事件 ---
    table.addEventListener('click', (event) => {
        const target = event.target.closest('.nthu-helper-search-btn');
        if (!target) return;

        const courseIndex = parseInt(target.dataset.index, 10);
        const course = courses[courseIndex];
        
        if(course) {
            NthuCourseHelperUI.showSearchMenu(event.clientX, event.clientY, course);
        }
    });

    // --- 回到最上方按鈕的事件 ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    table.addEventListener('click', (event) => {
        const bookmarkLabel = event.target.closest('.bookmark');
        if (!bookmarkLabel) return;

        const index = parseInt(bookmarkLabel.dataset.index, 10);
        const course = courses[index];
        if (!course) return;

        const checkbox = bookmarkLabel.querySelector('input[type="checkbox"]');
        
        // 尋找課程是否已在暫存清單中
        const savedIndex = savedCourses.findIndex(c => c.id === course.id);

        if (checkbox.checked && savedIndex === -1) {
            // 新增到暫存
            savedCourses.push(course);
        } else if (!checkbox.checked && savedIndex > -1) {
            // 從暫存移除
            savedCourses.splice(savedIndex, 1);
        }
        
        // 將更新後的列表存回 storage
        chrome.storage.sync.set({ 'savedCourses': savedCourses }, () => {
            //console.log('暫存清單已更新', savedCourses);
            updateSavedListButton(); // 更新浮動按鈕狀態
        });
    });

    // --- 【新增】查看暫存清單按鈕的事件 ---
    const savedListButton = document.getElementById('nthu-helper-saved-list-btn');
    if (savedListButton) {
        savedListButton.addEventListener('click', openSavedCoursesModal);
    }
}

// 執行主函式
main();