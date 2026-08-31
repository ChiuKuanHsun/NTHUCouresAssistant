// scripts/content.js
// 這是擴充功能的進入點 (Entry Point)

function applyFramesetRatio(ratio) {
    // 確保我們在最外層的 frameset 頁面
    const frameset = document.querySelector('frameset');
    if (frameset) {
        frameset.rows = `${ratio},*`;
    }
}

/**
 * 從子 frame（偏好設定視窗所在的課程表格 frame）直接調最外層 frameset 的比例。
 * 各 frame 同源，可以直接存取 window.top.document（這份程式碼讀 mainFrame 也是同樣做法）。
 */
function applyFramesetRatioToTop(ratio) {
    try {
        const frameset = window.top.document.querySelector('frameset');
        if (frameset) {
            frameset.rows = `${ratio},*`;
        }
    } catch (error) {
        console.error('套用框架比例失敗：', error);
    }
}
let savedCourses = [];

// 暫存清單改存在 storage.local。
// storage.sync 的 QUOTA_BYTES_PER_ITEM 只有 8KB，整份清單存在同一個 key，
// 約 19~20 筆就會超過而讓 set() 靜默失敗；local 的額度是 10MB。
const SAVED_COURSES_KEY = 'savedCourses';

/**
 * 只保留暫存清單真正會用到的欄位。
 * 課程物件原本帶有 element（DOM 節點）等無法序列化又佔空間的欄位。
 */
function toSavedCourse(course) {
    return {
        id: course.id,
        name: course.name,
        teacher: course.teacher,
        credit: course.credit,
        time: course.time,
        addActionArgs: course.addActionArgs,
        syllabusActionArgs: course.syllabusActionArgs,
        isGeInput: course.isGeInput
    };
}

function persistSavedCourses(callback) {
    chrome.storage.local.set({ [SAVED_COURSES_KEY]: savedCourses }, () => {
        // 舊版存在 sync 時超過 8KB 會在這裡靜默失敗，導致第 20 筆之後存不進去
        if (chrome.runtime.lastError) {
            console.error('暫存清單儲存失敗：', chrome.runtime.lastError.message);
            alert('暫存清單儲存失敗：' + chrome.runtime.lastError.message);
        }
        if (callback) callback();
    });
}

/**
 * 讀取暫存清單，並把舊版存在 storage.sync 的資料搬到 local。
 */
async function loadSavedCourses() {
    const local = await chrome.storage.local.get(SAVED_COURSES_KEY);
    if (Array.isArray(local[SAVED_COURSES_KEY])) {
        return local[SAVED_COURSES_KEY];
    }

    const sync = await chrome.storage.sync.get(SAVED_COURSES_KEY);
    const legacy = sync[SAVED_COURSES_KEY];
    if (Array.isArray(legacy) && legacy.length > 0) {
        const migrated = legacy.map(toSavedCourse);
        await chrome.storage.local.set({ [SAVED_COURSES_KEY]: migrated });
        await chrome.storage.sync.remove(SAVED_COURSES_KEY);
        return migrated;
    }
    return [];
}

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

// 通識科號總表的快取。整包只有兩百多個科號（約 3KB），存 local 綽綽有餘；
// 帶學期當版本，換學期自動失效，不必手動清。
const GE_COURSE_IDS_KEY = 'geCourseIds';
// 加退選期間通識課會增刪，光靠學期比對整學期都不會更新，所以再加一層時效
const GE_COURSE_IDS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 把「所有通識課的科號」補進 geCourseIds。
 * 先用快取，過期或換學期才連線重抓，抓到就寫回快取。
 * 有補到東西才呼叫 onUpdated（重跑篩選、重畫時間格顏色）。
 *
 * @param {Set<string>} geCourseIds - 就地補齊的集合（runFilter 透過閉包共用同一份）
 * @param {string} term - 學期代碼，取自科號前 5 碼，例如 '11510'。
 *        這個系所一門課都沒有時會是空字串，此時沿用快取裡的學期，不強制重抓。
 * @param {Function} onUpdated - 集合有變動時的回呼
 */
async function primeGeCourseIds(geCourseIds, term, onUpdated) {
    const sizeBefore = geCourseIds.size;
    const absorb = (ids) => ids.forEach(id => geCourseIds.add(id));
    const finish = () => {
        if (geCourseIds.size !== sizeBefore) onUpdated();
    };

    let cached = null;
    try {
        cached = (await chrome.storage.local.get(GE_COURSE_IDS_KEY))[GE_COURSE_IDS_KEY];
    } catch (error) {
        console.error('讀取通識科號快取失敗：', error);
    }

    const hasCache = !!(cached && Array.isArray(cached.ids) && cached.ids.length > 0);
    // term 為空（頁面上沒有任何課）時無從比對，就當作同一學期沿用快取
    const isSameTerm = hasCache && (!term || cached.term === term);
    const isFresh = hasCache && (Date.now() - (cached.fetchedAt || 0) < GE_COURSE_IDS_TTL_MS);

    // 先把同學期的快取吃進來（即使已過期），畫面才不會有幾秒鐘顏色是錯的
    if (hasCache && isSameTerm) {
        absorb(cached.ids);
    }

    if (hasCache && isSameTerm && isFresh) {
        finish();
        return;
    }

    const deptSelect = document.querySelector('select[name="new_dept"]');
    const fetched = await NthuCourseParser.fetchGeCourseIds(deptSelect);
    if (!fetched || fetched.size === 0) {
        // 抓取失敗就沿用上面已吃進來的舊資料，不覆寫快取，下次進頁面再試
        finish();
        return;
    }

    absorb(fetched);
    try {
        await chrome.storage.local.set({
            [GE_COURSE_IDS_KEY]: {
                term: term || (cached && cached.term) || '',
                ids: [...fetched],
                fetchedAt: Date.now()
            }
        });
    } catch (error) {
        console.error('寫入通識科號快取失敗：', error);
    }
    finish();
}

function openSavedCoursesModal(buttonRect) {
   const handleRemoveCourse = (courseIdToRemove) => {
        // 移除所有課程
        if (courseIdToRemove === null) {
            savedCourses = [];
            persistSavedCourses(() => {
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
        // 以科號查找，而不是信任 modal 中寫死的索引
        const indexToRemove = savedCourses.findIndex(c => c.id === courseIdToRemove);
        if (indexToRemove === -1) return;
        const courseToRemove = savedCourses[indexToRemove];

        // 從 JS 陣列中移除
        savedCourses.splice(indexToRemove, 1);

        // 更新 storage
        persistSavedCourses(() => {
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
            const courseId = target.dataset.courseId;
            const course = courseId ? savedCourses.find(c => c.id === courseId) : null;

            if (!action || !course) return;

            if (action === 'add' && course.addActionArgs) {
                if (course.isGeInput) {
                    const priorityInput = target.parentElement.querySelector(`.ge-priority-input[data-course-id="${courseId}"]`);
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
    savedCourses = await loadSavedCourses();
    const prefs = await NthuCoursePrefs.load();
    if (window.location.href.includes('JH713003.php') || window.location.href.includes('JH761003.php')) {
        if (prefs.framesetRatio) {
            applyFramesetRatio(prefs.framesetRatio);
        }
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

    // 只在真正需要（含課程表格）的 frame 注入 execute.js，
    // 避免在 frameset 的每一個 frame、每次重新載入時都注入造成額外負擔。
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('scripts/execute.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();

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
    // 5. 設定事件監聽器（並套用偏好設定的預設值）
    setupEventListeners(courses, courseTable, backToTopButton, prefs);
    
    
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
function setupEventListeners(courses, table, backToTopButton, prefs) {
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
    const timeFilterModeOptions = document.querySelector('.time-filter-mode-options');
    const allowXClassClashCheckbox = document.getElementById('nthu-helper-allow-xclass-clash');
    const refreshBtn = document.getElementById('nthu-helper-refresh-counts-btn');
    const saveBtn = document.getElementById('nthu-helper-save-schedule-btn');
    const openTempListBtn = document.getElementById('nthu-helper-open-temp-list-btn');
    const openPrefsBtn = document.getElementById('nthu-helper-open-prefs-btn');

    // 抽成具名函數，讓「預設自動更新即時人數」能直接重用同一段流程
    const refreshLiveCounts = async () => {
        if (refreshBtn) {
            refreshBtn.textContent = '更新中...';
            refreshBtn.disabled = true;
        }

        // 顯示所有課程的 loading spinner
        document.querySelectorAll('.live-count-cell').forEach(cell => {
            cell.innerHTML = `<div class="spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>`;
        });

        // 取得目前頁面的系所代碼
        const deptSelect = document.querySelector('select[name="new_dept"]');
        const departmentId = deptSelect.value.trim();

        try {
            const countsMap = await NthuCourseParser.fetchAndParseCounts(departmentId);

            // 更新頁面上的數字
            countsMap.forEach((data, courseId) => {
                const cell = document.getElementById(`count-${courseId}`);
                if (cell) {
                    cell.innerHTML = `${data.enrolled} / ${data.waiting}`;
                }
            });
        } catch (error) {
            // 自動觸發時沒人盯著畫面，失敗不能把 spinner 留在原地轉不停
            console.error('更新即時人數失敗：', error);
        }

        // 將沒有抓到資料的欄位恢復預設
        document.querySelectorAll('.live-count-cell').forEach(cell => {
            if (cell.innerHTML.includes('spinner')) {
                cell.innerHTML = 'N/A';
            }
        });

        if (refreshBtn) {
            refreshBtn.textContent = '更新即時人數';
            refreshBtn.disabled = false;
        }
    };

    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshLiveCounts);
    }
    // 所有通識課的科號。預排系統的已預排課表沒有類別標籤，只能靠科號比對。
    // 先用當前待選表能看到的（停在通識系所時就已經完整），稍後再由
    // primeGeCourseIds() 補上完整總表，讓其他系所的頁面也判得出來。
    const geCourseIds = new Set(
        courses
            .filter(course => course && course.isGe)
            .map(course => NthuCourseParser.normalizeCourseId(course.id))
    );

    // 統一的篩選觸發函數
    const runFilter = () => {
        const mainFrame = window.parent.frames['mainFrame'];
        let enrolledSchedule = [];
        if (mainFrame && mainFrame.document) {
            enrolledSchedule = NthuCourseParser.parseEnrolledCourses(mainFrame.document, geCourseIds);
        } else {
            console.error("找不到 mainFrame，無法讀取已選課程進行衝堂判斷。");
        }
        NthuCourseFilter.filterAll(table, courses, enrolledSchedule);
    };

    // --- 主要篩選器的事件 --- 
    saveBtn.addEventListener('click', () => {
        const mainFrame = window.parent.frames['mainFrame'];
        // 帶上通識科號，存進去的 isGe 才是對的 —— popup 的課表配色靠這個欄位
        const enrolledCourses = NthuCourseParser.parseEnrolledCourses(mainFrame.document, geCourseIds);
        chrome.storage.sync.set({ 'savedSchedule': enrolledCourses }, () => {
            alert('課表已成功儲存！');
            saveBtn.textContent = '課表已儲存';
            saveBtn.disabled = true;
        });
    });
    openTempListBtn.addEventListener('click', () => {
        openSavedCoursesModal();
    });
    if (openPrefsBtn) {
        openPrefsBtn.addEventListener('click', async () => {
            const currentPrefs = await NthuCoursePrefs.load();
            NthuCourseModal.showPreferencesModal(
                currentPrefs,
                (key, value, committed) => {
                    // 框架比例是唯一會即時生效的項目，拖曳過程中就跟著動
                    if (key === 'framesetRatio') {
                        applyFramesetRatioToTop(value);
                    }
                    if (committed) {
                        NthuCoursePrefs.set(key, value);
                    }
                },
                openPrefsBtn.getBoundingClientRect()
            );
        });
    }
    toggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        container.classList.toggle('collapsed');
        toggleBtn.textContent = container.classList.contains('collapsed') ? '展開' : '收合';
    });
    // 文字輸入用 debounce：每次按鍵都跑 filterAll 會對數百列逐一改 display，
    // 等於每個鍵都重排整張表。延遲到使用者停止輸入後再跑一次。
    let filterTimer = null;
    const debouncedFilter = () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(runFilter, 150);
    };
    nameFilter.addEventListener('input', debouncedFilter);
    teacherFilter.addEventListener('input', debouncedFilter);
    courseNoFilter.addEventListener('input', debouncedFilter);
    hideClashCheckbox.addEventListener('change', runFilter);
    if (allowGeClashCheckbox) {
        allowGeClashCheckbox.addEventListener('change', runFilter);
    }
    if (allowXClassClashCheckbox) {
        allowXClassClashCheckbox.addEventListener('change', runFilter);
    }
    if (timeFilterModeOptions) {
        timeFilterModeOptions.addEventListener('change', runFilter);
    }
    
    // --- 校區篩選器的事件 ---
    const campusOptions = document.querySelector('.campus-options');

    if (campusOptions) {
        campusOptions.addEventListener('change', (event) => {
            if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') {
                runFilter();
            }
        });
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
                    const enrolledSchedule = NthuCourseParser.parseEnrolledCourses(mainFrame.document, geCourseIds);
                    NthuCourseHelperUI.updateTimeGridHighlights(enrolledSchedule);
                }
            }
        });
    }
    setupTimeGridDragSelection(timeGrid, runFilter);

    // --- 套用偏好設定的預設值 ---
    // 放在所有監聽器綁定完之後，並且直接改狀態、手動跑一次 runFilter，
    // 而不是靠 dispatchEvent 觸發，避免四個預設值各自觸發一次重跑整張表。
    if (prefs) {
        let needsInitialFilter = false;

        if (prefs.defaultHideClash && hideClashCheckbox) {
            hideClashCheckbox.checked = true;
            needsInitialFilter = true;
        }
        // 這項只在通識頁有勾選框，且要搭配「隱藏衝堂」才會改變篩選結果，
        // 所以不用它自己去觸發一次 runFilter
        if (prefs.defaultAllowGeClash && allowGeClashCheckbox) {
            allowGeClashCheckbox.checked = true;
        }
        if (prefs.defaultAllowXClassClash && allowXClassClashCheckbox) {
            allowXClassClashCheckbox.checked = true;
            needsInitialFilter = true;
        }
        if (prefs.defaultExcludeNanda) {
            const nandaCheckbox = document.querySelector('.campus-options input[value="nanda"]');
            if (nandaCheckbox) {
                nandaCheckbox.checked = false;
                needsInitialFilter = true;
            }
        }
        if (needsInitialFilter) {
            runFilter();
        }
        if (prefs.defaultAutoRefreshCounts) {
            refreshLiveCounts();
        }
    }

    // --- 補齊通識科號總表 ---
    // 不 await：那個查詢回應接近 1MB，不能擋住面板顯示。抓回來之後再重跑一次
    // 篩選、重畫時間格顏色即可。
    // 學期代碼取自科號前 5 碼（例如 11510）。這個系所一門課都沒有時取不到，
    // 但仍要往下走 —— 快取本身還是能用，不該整個跳過。
    const sampleCourse = courses.find(course => course && course.id);
    const term = sampleCourse ? NthuCourseParser.normalizeCourseId(sampleCourse.id).slice(0, 5) : '';
    primeGeCourseIds(geCourseIds, term, () => {
        runFilter();
        // 時間格收合時不必重畫，展開時本來就會重新計算一次
        if (timeGridContainer && !timeGridContainer.classList.contains('collapsed')) {
            const mainFrame = window.parent.frames['mainFrame'];
            if (mainFrame && mainFrame.document) {
                NthuCourseHelperUI.updateTimeGridHighlights(
                    NthuCourseParser.parseEnrolledCourses(mainFrame.document, geCourseIds)
                );
            }
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
    // 用 requestAnimationFrame 節流，避免每個 scroll 事件都強制讀取 scrollY、
    // 造成長課程清單滑動時的卡頓；passive 讓瀏覽器不必等待 listener 即可捲動。
    let scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
            backToTopButton.classList.toggle('visible', window.scrollY > 200);
            scrollTicking = false;
        });
    }, { passive: true });
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
            // 新增到暫存（只存需要的欄位，course 帶有 element 等無法序列化的內容）
            savedCourses.push(toSavedCourse(course));
        } else if (!checkbox.checked && savedIndex > -1) {
            // 從暫存移除
            savedCourses.splice(savedIndex, 1);
        }

        // 將更新後的列表存回 storage
        persistSavedCourses(() => {
            updateSavedListButton(); // 更新浮動按鈕狀態
        });
    });

    // --- 【新增】查看暫存清單按鈕的事件 ---
    const savedListButton = document.getElementById('nthu-helper-saved-list-btn');
    if (savedListButton) {
        savedListButton.addEventListener('click', openSavedCoursesModal);
    }
}

/**
 * 時間格的拖曳勾選。
 * 按住滑鼠後拖曳，滑鼠劃過的每一格都會被點亮（或取消），只有實際經過的痕跡會改變。
 * 單純點一下等同於只劃過一格，行為和原本的點擊切換相同。
 * 點亮或取消由起點格決定：起點原本沒選 -> 一路點亮；原本已選 -> 一路取消。
 * @param {HTMLElement} timeGrid - .nthu-helper-time-grid 元素
 * @param {Function} runFilter - 拖曳結束後觸發的篩選函式
 */
function setupTimeGridDragSelection(timeGrid, runFilter) {
    if (!timeGrid) return;

    let dragging = false;
    let mode = 'select';   // 'select' 或 'deselect'
    let lastCell = null;   // 上一次處理到的格子，用來補上快速拖曳跳過的格
    let snapshot = null;   // 拖曳開始前的勾選狀態，Esc 取消時還原用
    let changed = false;   // 這次拖曳是否真的改動了勾選狀態

    const cellOf = (element) => {
        if (!element || !element.classList || !element.classList.contains('time-slot')) return null;
        return {
            day: parseInt(element.dataset.day, 10),
            row: parseInt(element.dataset.row, 10)
        };
    };

    const applyTo = (day, row) => {
        const slot = timeGrid.querySelector(`.time-slot[data-day="${day}"][data-row="${row}"]`);
        if (!slot) return;
        const shouldSelect = (mode === 'select');
        // 已經是目標狀態就不動，來回劃過同一格才不會一直翻面
        if (slot.classList.contains('selected') === shouldSelect) return;
        slot.classList.toggle('selected', shouldSelect);
        changed = true;
    };

    // pointermove 的取樣頻率有限，拖快一點就會跳過中間的格子；
    // 這裡沿著上一格到目前這一格的直線把中間補起來，痕跡才不會斷掉。
    const paintTrail = (cell) => {
        if (lastCell) {
            const steps = Math.max(
                Math.abs(cell.day - lastCell.day),
                Math.abs(cell.row - lastCell.row)
            );
            for (let step = 1; step < steps; step++) {
                const ratio = step / steps;
                applyTo(
                    Math.round(lastCell.day + (cell.day - lastCell.day) * ratio),
                    Math.round(lastCell.row + (cell.row - lastCell.row) * ratio)
                );
            }
        }
        applyTo(cell.day, cell.row);
        lastCell = cell;
    };

    const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        lastCell = null;
        snapshot = null;
        timeGrid.classList.remove('drag-selecting');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', endDrag);
        document.removeEventListener('pointercancel', cancelDrag);
        document.removeEventListener('keydown', onKeyDown);
        if (changed) runFilter();
    };

    // 中途按 Esc 取消，把勾選狀態還原成拖曳前
    const cancelDrag = () => {
        if (!dragging) return;
        timeGrid.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.toggle('selected', snapshot.has(slot));
        });
        changed = false;
        endDrag();
    };

    const onKeyDown = (event) => {
        if (event.key === 'Escape') cancelDrag();
    };

    const onPointerMove = (event) => {
        if (!dragging) return;
        // 事件掛在 document 上，用座標找出游標實際所在的格子
        const cell = cellOf(document.elementFromPoint(event.clientX, event.clientY));
        if (!cell) return;
        if (lastCell && cell.day === lastCell.day && cell.row === lastCell.row) return;
        paintTrail(cell);
    };

    timeGrid.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const cell = cellOf(event.target);
        if (!cell) return;

        event.preventDefault(); // 避免拖曳時選到頁面文字
        dragging = true;
        changed = false;
        lastCell = null;
        mode = event.target.classList.contains('selected') ? 'deselect' : 'select';
        snapshot = new Set();
        timeGrid.querySelectorAll('.time-slot').forEach(slot => {
            if (slot.classList.contains('selected')) snapshot.add(slot);
        });

        timeGrid.classList.add('drag-selecting');
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', endDrag);
        document.addEventListener('pointercancel', cancelDrag);
        document.addEventListener('keydown', onKeyDown);

        paintTrail(cell); // 只點一下時，等同於切換這一格
    });
}

// 執行主函式
main();