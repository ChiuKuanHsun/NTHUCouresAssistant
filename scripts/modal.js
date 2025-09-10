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