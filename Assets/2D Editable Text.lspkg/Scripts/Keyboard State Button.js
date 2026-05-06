// Keyboard State Button.js
// Version: 0.1.0
// Event: On Awake
// Description: Show a disabled / enabled button depending on the open/close state of the keyboard

// @input Component.Text text
// @input Asset.Texture enabledButton
// @input Asset.Texture disabledButton

var checkInputs = function() {
    if (!script.text) {
        print("ERROR: No text input set for Keyboard Button");
        return false;
    }
    if (!script.enabledButton) {
        print("ERROR: No enabled button input set for Keyboard Button");
        return false;
    }
    if (!script.disabledButton) {
        print("ERROR: No disabled button input set for Keyboard Button");
        return false;
    }
    
    return true;
};

var init = function() {
    script.text.onEditingFinished.add(function() {
        script.getSceneObject().getComponent("Component.Image").mainMaterial.mainPass.baseTex = script.enabledButton;
    });

    script.text.onEditingStarted.add(function() {
        script.getSceneObject().getComponent("Component.Image").mainMaterial.mainPass.baseTex = script.disabledButton;
    });
};

if (checkInputs()) {
    init();
}

