// @ts-check

document.addEventListener(
    'DOMContentLoaded',
    () => {
        const buttons = document.getElementsByTagName('button');
        for (const button of buttons) {
            const buttonName = button.type + '<' + button.textContent?.trim() + '>';
            const clickFunc = button.onclick;
            if (!clickFunc) {
                button.onclick = () => console.log(buttonName + '; no click function');
                return;
            }
            let clickFuncBody = clickFunc.toString() ?? '';
            if (clickFuncBody) {
                clickFuncBody = clickFuncBody
                    .slice(clickFuncBody.indexOf('{') + 1, clickFuncBody.lastIndexOf('}'))
                    .trim()
                    .split(';')
                    .join('\n\t\t');

                button.onclick = (event) => {
                    console.log(buttonName + ':\n\t\t' + clickFuncBody);
                    clickFunc.apply(button, event);
                };
            }
        }
    },
    false,
);

async function loadSourceCode(name, path) {
    const sourceCode = await (await fetch(path)).text();
    const elements = document.getElementsByName(name);
    elements.forEach((element) => (element.innerHTML = sourceCode));
}

/**
 * Toggles collapsed state on the named elements, and toggles the text on the
 * given element
 */
function collapse(self, toggleText, name) {
    self.classList.toggle('collapse-active');
    if (!self.getAttribute('data-toggle-text')) {
        self.setAttribute('data-toggle-text', toggleText);
    }
    const text = self.getAttribute('data-toggle-text');
    self.setAttribute('data-toggle-text', self.innerHTML);
    self.innerHTML = text;
    const elements = document.getElementsByName(name);
    if (!elements.length) {
        console.warn(`Tried to toggle collapsible elements named ${name}, but it wasn't on the page!`);
        return;
    }
    elements.forEach((element) => {
        if (element.style.maxHeight) {
            element.style.maxHeight = '';
        } else {
            element.style.maxHeight = element.scrollHeight + 'px';
        }
    });
}

/**
 * Hides the incoming button, then shows all following buttons
 * under the same parent.
 */
function hideButtons(button) {
    button.setAttribute('hidden', '');
    while ((button = button.nextElementSibling)) {
        button.removeAttribute('hidden');
    }
}

//@ts-ignore
window.collapse = collapse;
//@ts-ignore
window.hideButtons = hideButtons;
//@ts-ignore
window.loadSourceCode = loadSourceCode;
