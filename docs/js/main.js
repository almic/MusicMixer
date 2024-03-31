async function loadSourceCode(name, path) {
    const sourceCode = await (await fetch(path)).text();
    const elements = document.getElementsByName(name);
    elements.forEach((element) => (element.innerHTML = sourceCode));
}

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
            element.style.maxHeight = null;
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
