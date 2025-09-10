(function() {
    'use strict';


    const folderDivs = document.querySelectorAll('div[id^="folder"]');


    folderDivs.forEach(div => {
        const sourceLink = div.querySelector('td:first-child a[href]');
        const targetTextAnchor = div.querySelector('td:nth-child(2) a');

        if (sourceLink && targetTextAnchor) {
            const linkHref = sourceLink.getAttribute('href');
            targetTextAnchor.setAttribute('href', linkHref);
            targetTextAnchor.style.cursor = 'pointer';
        }
    });
})();