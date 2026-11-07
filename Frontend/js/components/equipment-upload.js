/*
 * FANTASYREALM - EMPLOYEE EQUIPMENT UPLOAD FORM
 *
 * Progressive enhancement for the existing #accessory-form. This module
 * adds the gender/replacement-body inputs without replacing the existing
 * employee dashboard controller, including moderation and other actions.
 *
 * The capture-phase submit handler deliberately overrides ONLY this
 * accessory creation form; all other staff controls stay untouched.
 */
(() => {
    'use strict';

    function init() {
        const form = document.getElementById('accessory-form');
        const type = document.getElementById('accessory-type');
        const submit = document.getElementById('accessory-add-button');
        if (!form || !type || !submit) return;

        const existingImage = document.getElementById('accessory-image');
        let image = existingImage;
        if (!image) {
            const row = document.createElement('div');
            const label = document.createElement('label');
            label.htmlFor = 'accessory-image';
            label.textContent = 'Equipment image';
            image = document.createElement('input');
            image.id = 'accessory-image';
            image.name = 'image';
            image.type = 'file';
            image.required = true;
            row.append(label, image);
            submit.before(row);
        }

        const sexRow = document.createElement('div');
        const sexLabel = document.createElement('label');
        sexLabel.htmlFor = 'equipment-gender';
        sexLabel.textContent = 'Character gender';
        const sex = document.createElement('select');
        sex.id = 'equipment-gender';
        for (const [value, text] of [['', 'Choose a gender'], ['male', 'Male'], ['female', 'Female']]) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = text;
            sex.appendChild(opt);
        }
        sexRow.append(sexLabel, sex);
        submit.before(sexRow);

        const bodyRow = document.createElement('div');
        const bodyLabel = document.createElement('label');
        bodyLabel.htmlFor = 'equipment-body-image';
        bodyLabel.textContent = 'Replacement body PNG';
        const body = document.createElement('input');
        body.id = 'equipment-body-image';
        body.name = 'body_image';
        body.type = 'file';
        body.accept = 'image/png';
        const hint = document.createElement('small');
        hint.textContent = 'Transparent PNG, 568 x 1275 px, maximum 4 MB.';
        bodyRow.append(bodyLabel, body, hint);
        submit.before(bodyRow);

        const message = document.getElementById('accessory-feedback');
        let uploading = false;

        function show(messageText, error = false) {
            if (!message) return;
            message.hidden = false;
            message.textContent = messageText;
            message.classList.toggle('is-error', error);
            message.classList.toggle('is-success', !error);
        }

        function updateFields() {
            const wearable = type.value === 'armor' || type.value === 'clothing';
            sexRow.hidden = !wearable;
            bodyRow.hidden = !wearable;
            sex.required = wearable;
            body.required = wearable;
            image.accept = wearable ? 'image/png' : 'image/png,image/jpeg,image/webp';
            if (!wearable) {
                sex.value = '';
                body.value = '';
            }
        }
        type.addEventListener('change', updateFields);
        updateFields();

        /** Validate client input; the backend repeats every security check. */
        function validateFile(file, strict, label) {
            if (!file || file.size < 1 || file.size > 4 * 1024 * 1024) {
                throw new Error(`${label}: choose a file up to 4 MB.`);
            }
            if (strict ? file.type !== 'image/png' :
                !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                throw new Error(`${label}: invalid image format.`);
            }
        }

        async function upload() {
            const wearable = type.value === 'armor' || type.value === 'clothing';
            const name = document.getElementById('accessory-name')?.value.trim() ?? '';
            const itemType = type.value;
            if (!name || Array.from(name).length > 100 ||
                !['weapon', 'armor', 'clothing', 'accessory'].includes(itemType)) {
                throw new Error('Enter a valid name and type.');
            }
            if (wearable && !['male', 'female'].includes(sex.value)) {
                throw new Error('Choose male or female.');
            }
            validateFile(image.files?.[0], wearable, 'Equipment image');
            if (wearable) validateFile(body.files?.[0], true, 'Body image');

            const sessionResponse = await fetch('/FantasyRealm/Backend/api/session.php', {
                credentials: 'same-origin', cache: 'no-store'
            });
            if (!sessionResponse.ok) throw new Error('Your session has expired.');
            const session = await sessionResponse.json();
            if (!session.authenticated || !session.csrf_token) {
                throw new Error('Your session has expired.');
            }

            const data = new FormData();
            data.append('name', name);
            data.append('type', itemType);
            data.append('image', image.files[0]);
            if (wearable) {
                data.append('gender', sex.value);
                data.append('body_image', body.files[0]);
            }

            const response = await fetch('/FantasyRealm/Backend/api/add-accessory.php', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json', 'X-CSRF-Token': session.csrf_token },
                body: data
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success !== true) {
                throw new Error(result?.message || 'Unable to upload equipment.');
            }
            return result;
        }

        // Capture runs before the employee dashboard's existing submit listener.
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (uploading) return;
            uploading = true;
            submit.disabled = true;
            try {
                const result = await upload();
                form.reset();
                updateFields();
                show(result.message || 'Equipment added successfully.');
                // Reuse the existing dashboard refresh function when available.
                const refresh = document.querySelector('[data-refresh="accessories"]');
                if (refresh) refresh.click();
            } catch (error) {
                show(error.message || 'Upload failed.', true);
            } finally {
                uploading = false;
                submit.disabled = false;
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
