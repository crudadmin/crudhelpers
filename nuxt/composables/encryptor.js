export const encryptText = (text) => {
    if (!text) {
        return;
    }

    return btoa('XYQ' + btoa(text));
};

export const decryptText = (text) => {
    if (!text) {
        return;
    }

    try {
        return atob(atob(text).slice(3));
    } catch (e) {
        return text;
    }
};

export const runDecryptor = () => {
    /*
     * Selectors
     */
    var toEncryptClass = 'toEncrypt',
        toEncryptHrefClass = 'toEncryptHref';

    var elementsToFullDecrypt = document.getElementsByClassName(toEncryptClass),
        elementsToHrefDecrypt =
            document.getElementsByClassName(toEncryptHrefClass),
        decryptHref = (element) => {
            var href = element.getAttribute('href');

            //Decrypt also href value
            if (href) {
                element.href = decryptText(href);
            }
        };

    //Decrypt text + href
    //We need use while, because getElementsByClassName is dynamic and elements would be removed dynamicaly in for
    while (elementsToFullDecrypt.length > 0) {
        var element = elementsToFullDecrypt[0];

        element.innerHTML = decryptText(element.innerHTML);
        decryptHref(element);

        element.classList.remove(toEncryptClass);
    }

    //Decrypt href
    for (var i = 0; i < elementsToHrefDecrypt.length; i++) {
        decryptHref(elementsToHrefDecrypt[i]);
    }
};
