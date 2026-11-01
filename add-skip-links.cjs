const fs = require('node:fs');
const path = require('node:path');

const htmlFolder = path.join(__dirname, 'Frontend', 'Html');
let updated = 0;

for (const filename of fs.readdirSync(htmlFolder)) {
    if (!filename.endsWith('.html')) continue;

    const filepath = path.join(htmlFolder, filename);
    let html = fs.readFileSync(filepath, 'utf8');

    if (!/<main\b/i.test(html) || !/<body\b/i.test(html)) {
        continue;
    }

    const original = html;
    const nl = html.includes('\r\n') ? '\r\n' : '\n';

    // Load shared accessibility CSS.
    if (!html.includes('../Css/accessibility.css')) {
        html = html.replace(
            /<\/head>/i,
            `    <link rel="stylesheet" href="../Css/accessibility.css">${nl}</head>`
        );
    }

    // Add skip link unless one already exists.
    if (!/class=["'][^"']*\bskip-link\b/i.test(html)) {
        html = html.replace(
            /<body\b[^>]*>/i,
            match => `${match}${nl}    <a class="skip-link" href="#main-content">Skip to main content</a>`
        );
    }

    // Make main content a navigation target.
    const mainTag = html.match(/<main\b[^>]*>/i);

    if (mainTag) {
        let tag = mainTag[0];

        if (/\bid\s*=/.test(tag) && !/\bid=["']main-content["']/i.test(tag)) {
            console.log(`Skipped ${filename}: main already has another ID`);
            continue;
        }

        if (!/\bid\s*=/.test(tag)) {
            tag = tag.replace('<main', '<main id="main-content"');
        }

        if (!/\btabindex\s*=/.test(tag)) {
            tag = tag.replace('<main', '<main tabindex="-1"');
        }

        html = html.replace(mainTag[0], tag);
    }

    if (html !== original) {
        fs.writeFileSync(filepath, html, 'utf8');
        updated++;
        console.log(`Updated: ${filename}`);
    }
}

console.log(`Finished! Updated ${updated} pages.`);