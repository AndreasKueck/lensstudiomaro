// @input Component.Text textComponent
// @input Component.Text eligoTeksto
// @input Asset.CloudStorageModule cloudStorageModule

var datumojCache = null;
var datumojCacheSource = null;
var aktualaDatumojTeksto = null;

script.store = null;
var cloudStoreReady = false;
var cloudStoreInitStarted = false;
var pendingSaveValue = null;
var pendingLoadCallbacks = [];

var CLOUD_KEY = "tideInput";

var DEFAULT_DATUMOJ = `M2 132.741909 -18.798868 2 0 0 0 0 0 0
N2 21.416288 -44.772829 2 -1 0 1 0 0 0
S2 34.035663 51.595649 2 2 -2 0 0 0 0
K2 10.270645 49.497113 2 2 0 0 0 0 0
2N2 0.869336 -9.507892 2 -2 0 2 0 0 0
S1 0.776315 37.206517 1 1 -1 0 0 1 1
K1 7.552466 43.617815 1 1 0 0 0 0 1
P1 3.15716 53.599694 1 1 -2 0 0 0 -1
O1 9.05433 -107.311968 1 -1 0 0 0 0 -1
Q1 2.61827 -160.282744 1 -2 0 1 0 0 -1
M1 0.559303 16.06543 1 0 0 1 0 0 1
M4 10.591015 -147.695609 4 0 0 0 0 0 0
MM 2.154814 -147.532816 0 1 0 -1 0 0 0
MF 1.150955 -175.048688 0 2 0 0 0 0 0
SA 10.417475 -115.833536 0 0 1 0 0 -1 0
SSA 5.309425 -173.836883 0 0 2 0 0 0 0
T2 1.827479 39.962074 2 2 -3 0 0 1 0
J1 0.451758 132.147603 1 2 0 -1 0 0 1
L2 11.439029 -1.733522 2 1 0 -1 0 0 2
R2 0.40084 13.535807 2 2 -1 0 0 -1 2
2Q1 0.645097 110.941402 1 -3 0 2 0 0 -1
MSF 2.80441 48.080651 0 2 -2 0 0 0 0
MSQM 1.633025 -144.945262 0 4 -2 0 0 0 0
EP2 3.553836 53.203184 2 -3 2 1 0 0 0
M3 0.567985 -164.832244 3 0 0 0 0 0 2
MU2 13.186214 71.873159 2 -2 2 0 0 0 0
MTM 0.520988 -165.024071 0 3 0 -1 0 0 0
NU2 7.506081 -64.41662 2 -1 2 -1 0 0 0
LAMBDA2 4.694611 -7.195269 2 1 -2 1 0 0 2
MN4 3.829558 -166.259866 4 -1 0 1 0 0 0
MS4 6.678563 -85.899375 4 2 -2 0 0 0 0
MKS2 1.155672 158.230215 2 -1 0 0 0 0 0
N4 0.554048 -173.553053 4 -2 0 2 0 0 0
M6 7.064188 55.439853 6 0 0 0 0 0 0
M8 1.088542 -51.015314 8 0 0 0 0 0 0
S4 0.715169 18.705991 4 4 -4 0 0 0 0
OO1 0.521149 -68.362267 1 3 0 0 0 0 1
S3 0.07223 87.921523 3 3 -3 0 0 0 2
MA2 4.357697 -72.554396 2 0 -1 0 0 0 0
MB2 2.698539 35.287129 2 0 1 0 0 0 0
T3 0.162219 48.796041 3 3 -4 0 0 0 0
R3 0.244048 -88.252977 3 3 -2 0 0 0 0
RHO1 0.672603 160.866113 1 -2 2 -1 0 0 -1
SGM 0.463479 -90.774309 1 -3 2 0 0 0 -1
3L2 1.044693 90.086448 2 1 0 0 0 0 0
3N2 0.552452 22.270886 2 0 2 0 0 0 0
2SM2 2.954387 -84.458936 2 4 -4 0 0 0 0
2MS6 6.597852 119.038423 6 2 -2 0 0 0 0
2MK5 0.418761 -23.210387 5 1 0 0 0 0 1
2MO5 0.21434 62.960188 5 -1 0 0 0 0 -1`;

var DEFAULT_DATE = "20270426";
var DEFAULT_PLACE = "Cuxhaven";
var DEFAULT_FULL_INPUT = DEFAULT_DATUMOJ + "\n" + DEFAULT_DATE + " " + DEFAULT_PLACE;

var initialLoadStarted = false;
var initialLoadDone = false;

// ---------------- CLOUD STORAGE ----------------

function onCloudStorageError(code, message) {
    print("CloudStorage-Fehler: " + code + " " + message);
}

function flushPendingLoadCallbacks(value) {
    var callbacks = pendingLoadCallbacks.slice();
    pendingLoadCallbacks = [];

    for (var i = 0; i < callbacks.length; i++) {
        try {
            callbacks[i](value);
        } catch (e) {
            print("Fehler in Load-Callback: " + e);
        }
    }
}

function onCloudStoreInitError(code, message) {
    print("CloudStore-Initialisierung fehlgeschlagen: " + code + " " + message);
    cloudStoreReady = false;
    cloudStoreInitStarted = false;
    flushPendingLoadCallbacks(null);
}

function onCloudStoreReady(store) {
    print("CloudStore created");
    script.store = store;
    cloudStoreReady = true;
    cloudStoreInitStarted = false;

    if (pendingSaveValue !== null) {
        var valueToSave = pendingSaveValue;
        pendingSaveValue = null;
        saveInputToCloud(valueToSave);
    }

    if (pendingLoadCallbacks.length > 0) {
        fetchCloudValue(function(value) {
            flushPendingLoadCallbacks(value);
        });
    }
}

function createCloudStore() {
    if (cloudStoreReady || cloudStoreInitStarted) {
        return;
    }

    if (!script.cloudStorageModule) {
        print("Kein CloudStorageModule als Script-Input gesetzt.");
        flushPendingLoadCallbacks(null);
        return;
    }

    cloudStoreInitStarted = true;

    var cloudStorageOptions = CloudStorageOptions.create();
    script.cloudStorageModule.getCloudStore(
        cloudStorageOptions,
        onCloudStoreReady,
        onCloudStoreInitError
    );
}

function fetchCloudValue(callback) {
    if (!script.store) {
        callback(null);
        return;
    }

    var readOptions = CloudStorageReadOptions.create();
    readOptions.scope = StorageScope.User;

    script.store.getValue(
        CLOUD_KEY,
        readOptions,
        function onSuccess(key, value) {
            callback(value || null);
        },
        function onNotFound() {
            callback(null);
        }
    );
}

function saveInputToCloud(value) {
    if (!value || value.trim().length === 0) {
        return;
    }

    if (!cloudStoreReady || !script.store) {
        pendingSaveValue = value;
        createCloudStore();
        return;
    }

    var writeOptions = CloudStorageWriteOptions.create();
    writeOptions.scope = StorageScope.User;

    script.store.setValue(
        CLOUD_KEY,
        value,
        writeOptions,
        function onSuccess() {
            print("Eingabe im Cloud Storage gespeichert.");
        },
        onCloudStorageError
    );
}

function loadInputFromCloud(callback) {
    if (!callback) {
        return;
    }

    if (!cloudStoreReady || !script.store) {
        pendingLoadCallbacks.push(callback);
        createCloudStore();
        return;
    }

    fetchCloudValue(callback);
}

// ---------------- INITIAL LOAD ----------------

function buildEffectiveInput(storedInput) {
    var effectiveInput = storedInput && storedInput.trim().length > 0 ? storedInput : DEFAULT_FULL_INPUT;
    var parsed = parseEnigo(effectiveInput);

    if (!parsed) {
        effectiveInput = DEFAULT_FULL_INPUT;
        parsed = parseEnigo(effectiveInput);
    }

    return {
        text: effectiveInput,
        parsed: parsed
    };
}

function initializeInputFromCloudOrDefault() {
    if (initialLoadStarted || initialLoadDone) {
        return;
    }

    initialLoadStarted = true;

    if (script.textComponent) {
        var currentText = script.textComponent.text || "";
        if (currentText.trim().length === 0) {
            script.textComponent.text = DEFAULT_FULL_INPUT;
        }
    }

    var defaultPrepared = buildEffectiveInput(DEFAULT_FULL_INPUT);
    if (defaultPrepared.parsed) {
        main(defaultPrepared.parsed);
    }

    loadInputFromCloud(function(storedInput) {
        var prepared = buildEffectiveInput(storedInput);

        if (script.textComponent) {
            script.textComponent.text = prepared.text;
        }

        initialLoadDone = true;
        initialLoadStarted = false;

        if (prepared.parsed) {
            main(prepared.parsed);
        }
    });
}

// ---------------- INPUT / PARSING ----------------

function parseEnigo(rawText) {
    var text = rawText ? rawText.trim() : "";
    if (text.length === 0) {
        return null;
    }

    var match = text.match(/([\s\S]*?)\b(\d{8})\b(?:\s+([\s\S]+))?$/);
    if (!match) {
        return null;
    }

    var datumojTeksto = match[1].trim();
    var dato = match[2];
    var loknomo = match[3] ? match[3].replace(/\s+/g, " ").trim() : DEFAULT_PLACE;

    if (parseDatumoj(datumojTeksto).length === 0) {
        return null;
    }

    return {
        datumojTeksto: datumojTeksto,
        dato: dato,
        loknomo: loknomo
    };
}

function onUpdateEvent(eventData) {
    if (!initialLoadDone && (!script.textComponent.text || script.textComponent.text.trim().length === 0)) {
        initializeInputFromCloudOrDefault();
        return;
    }

    var currentInput = script.textComponent.text;
    print("Enigo: " + currentInput);

    if (currentInput && currentInput.trim().length > 0) {
        var parsedCurrent = parseEnigo(currentInput);

        if (parsedCurrent) {
            saveInputToCloud(currentInput);
            main(parsedCurrent);
        } else {
            loadInputFromCloud(function(storedInput) {
                var prepared = buildEffectiveInput(storedInput);

                if (script.textComponent) {
                    script.textComponent.text = prepared.text;
                }

                if (prepared.parsed) {
                    main(prepared.parsed);
                }
            });
        }
        return;
    }

    loadInputFromCloud(function(storedInput) {
        var prepared = buildEffectiveInput(storedInput);

        if (script.textComponent) {
            script.textComponent.text = prepared.text;
        }

        if (prepared.parsed) {
            main(prepared.parsed);
        }
    });
}

// ---------------- MAIN ----------------

function main(parsedInput) {
    if (!parsedInput) {
        script.eligoTeksto.text =
            "Enigu la harmoniajn gezeitenkonstituentojn kun Doodson-numeroj,\n" +
            "poste la daton per ok ciferoj, ekz. 20270426,\n" +
            "kaj poste la loknomon.";
        return;
    }

    aktualaDatumojTeksto = parsedInput.datumojTeksto;

    var dato0 = parsedInput.dato;
    var loknomo = parsedInput.loknomo;

    var zt = -1.0;
    var jaro = dato0.substr(0, 4) * 1.0;
    var monato = dato0.substr(4, 2) * 1.0;
    var tago = dato0.substr(6, 2) * 1.0;
    var monatosignoj = dato0.substr(4, 2);
    var tagosignoj = dato0.substr(6, 2);

    var z = [];
    var h = [];
    var nw = [];
    var hw = [];
    var min = [];
    var max = [];

    var nvo = -999.9;
    var zt1 = zt;
    var zt2 = 0.0;
    var rezulto = '';
    var i = 0;
    var j = 0;
    var k = 0;

    var nwminh1 = 999.9;
    var nwminz1 = '';
    var nwminh2 = 999.9;
    var nwminz2 = '';
    var hwmaxh1 = -999.9;
    var hwmaxz1 = '';
    var hwmaxh2 = -999.9;
    var hwmaxz2 = '';

    if (zt >= 0.0) {
        zt1 = zt;
        nvo = niv(zt1, tago, monato, jaro);
    } else {
        for (i = -1; i < 1442; i++) {
            zt1 = i * 0.01 * 5.0 / 3.0;
            zt2 = (zt1 - Math.floor(zt1)) * 3 / 5 + Math.floor(zt1);
            z[i] = zt1;
            h[i] = niv(zt2, tago, monato, jaro);
        }

        for (i = 0; i < 1441; i++) {
            if (h[i] < h[i - 1] && h[i] < h[i + 1]) {
                nw[j] = z[i];
                min[j] = h[i];
                j++;
            }
            if (h[i] > h[i - 1] && h[i] > h[i + 1]) {
                hw[k] = z[i];
                max[k] = h[i];
                k++;
            }
        }

        var lj = nw.length;
        var lj1 = Math.floor(lj / 2.0);
        for (i = 0; i < lj1; i++) {
            if (min[i] < nwminh1) {
                nwminh1 = min[i];
                nwminz1 = nw[i];
            }
        }
        for (i = lj1; i < lj; i++) {
            if (min[i] < nwminh2) {
                nwminh2 = min[i];
                nwminz2 = nw[i];
            }
        }

        var lk = hw.length;
        var lk1 = Math.floor(lk / 2.0);
        for (i = 0; i < lk1; i++) {
            if (max[i] > hwmaxh1) {
                hwmaxh1 = max[i];
                hwmaxz1 = hw[i];
            }
        }
        for (i = lk1; i < lk; i++) {
            if (max[i] > hwmaxh2) {
                hwmaxh2 = max[i];
                hwmaxz2 = hw[i];
            }
        }

        nwminz1 = (nwminz1 - Math.floor(nwminz1)) * 3 / 5 + Math.floor(nwminz1);
        nwminz2 = (nwminz2 - Math.floor(nwminz2)) * 3 / 5 + Math.floor(nwminz2);
        hwmaxz1 = (hwmaxz1 - Math.floor(hwmaxz1)) * 3 / 5 + Math.floor(hwmaxz1);
        hwmaxz2 = (hwmaxz2 - Math.floor(hwmaxz2)) * 3 / 5 + Math.floor(hwmaxz2);

        var rnwz1 = Math.round(nwminz1 * 100) / 100 + " UTK ";
        var rnwz2 = Math.round(nwminz2 * 100) / 100 + " UTK ";
        var rhwz1 = Math.round(hwmaxz1 * 100) / 100 + " UTK ";
        var rhwz2 = Math.round(hwmaxz2 * 100) / 100 + " UTK ";

        var rnwh1 = Math.round(nwminh1 * 10) / 10 + " m";
        var rnwh2 = Math.round(nwminh2 * 10) / 10 + " m";
        var rhwh1 = Math.round(hwmaxh1 * 10) / 10 + " m";
        var rhwh2 = Math.round(hwmaxh2 * 10) / 10 + " m";

        var srnwz1 = rnwz1.replace(/\./, ":");
        var srnwz2 = rnwz2.replace(/\./, ":");
        var srhwz1 = rhwz1.replace(/\./, ":");
        var srhwz2 = rhwz2.replace(/\./, ":");

        var srnwh1 = rnwh1.replace(/\./, ",");
        var srnwh2 = rnwh2.replace(/\./, ",");
        var srhwh1 = rhwh1.replace(/\./, ",");
        var srhwh2 = rhwh2.replace(/\./, ",");

        if (/999/.test(srnwh1)) {
            srnwh1 = "";
            srnwz1 = "";
        }
        if (/999/.test(srnwh2)) {
            srnwh2 = "";
            srnwz2 = "";
        }
        if (/999/.test(srhwh1)) {
            srhwh1 = "";
            srhwz1 = "";
        }
        if (/999/.test(srhwh2)) {
            srhwh2 = "";
            srhwz2 = "";
        }

        if (/\:\d UTK/.test(srnwz1)) { srnwz1 = srnwz1.replace(/ UTK/, "0 UTK"); }
        if (/\:\d UTK/.test(srnwz2)) { srnwz2 = srnwz2.replace(/ UTK/, "0 UTK"); }
        if (/\:\d UTK/.test(srhwz1)) { srhwz1 = srhwz1.replace(/ UTK/, "0 UTK"); }
        if (/\:\d UTK/.test(srhwz2)) { srhwz2 = srhwz2.replace(/ UTK/, "0 UTK"); }

        if (!(/\:/.test(srnwz1))) { srnwz1 = srnwz1.replace(/ UTK/, ":00 UTK"); }
        if (!(/\:/.test(srnwz2))) { srnwz2 = srnwz2.replace(/ UTK/, ":00 UTK"); }
        if (!(/\:/.test(srhwz1))) { srhwz1 = srhwz1.replace(/ UTK/, ":00 UTK"); }
        if (!(/\:/.test(srhwz2))) { srhwz2 = srhwz2.replace(/ UTK/, ":00 UTK"); }

        if (!(/\d\,\d m/.test(srnwh1))) { srnwh1 = srnwh1.replace(/ m/, ",0 m"); }
        if (!(/\d\,\d m/.test(srnwh2))) { srnwh2 = srnwh2.replace(/ m/, ",0 m"); }
        if (!(/\d\,\d m/.test(srhwh1))) { srhwh1 = srhwh1.replace(/ m/, ",0 m"); }
        if (!(/\d\,\d m/.test(srhwh2))) { srhwh2 = srhwh2.replace(/ m/, ",0 m"); }

        srnwz1 = srnwz1.replace(/(\d+):60 UTK /, function(match, horo60) {
            return (parseInt(horo60) + 1) + ":00 UTK ";
        });
        srnwz2 = srnwz2.replace(/(\d+):60 UTK /, function(match, horo60) {
            return (parseInt(horo60) + 1) + ":00 UTK ";
        });
        srhwz1 = srhwz1.replace(/(\d+):60 UTK/, function(match, horo60) {
            return (parseInt(horo60) + 1) + ":00 UTK ";
        });
        srhwz2 = srhwz2.replace(/(\d+):60 UTK /, function(match, horo60) {
            return (parseInt(horo60) + 1) + ":00 UTK ";
        });

        if (srnwz1.length == 9) { srnwz1 = "0" + srnwz1; }
        if (srnwz2.length == 9) { srnwz2 = "0" + srnwz2; }
        if (srhwz1.length == 9) { srhwz1 = "0" + srhwz1; }
        if (srhwz2.length == 9) { srhwz2 = "0" + srhwz2; }

        rezulto = srnwz1 + srnwh1 + '\n' + srnwz2 + srnwh2 + '\n' + srhwz1 + srhwh1 + '\n' + srhwz2 + srhwh2;
    }

    if (zt >= 0.0) {
        print(Math.round(nvo * 1000000) / 1000000);
    } else {
        print(rezulto);
        if (jaro != 0 && /^\d{8}$/.test(dato0)) {
            script.eligoTeksto.text =
                "Jen kelkaj elstaraj akvoniveloj por " + loknomo +
                " prognozitaj por " + jaro + "-" + monatosignoj + "-" + tagosignoj +
                " (privata neoficiala prognozo ne tauga por navigaciaj celoj):\n" +
                rezulto + "\nUTK: Universala Tempo Kunordigita";
        } else {
            script.eligoTeksto.text =
                "Enigu la harmoniajn gezeitenkonstituentojn kun Doodson-numeroj,\n" +
                "poste la daton per ok ciferoj, ekz. 20270426,\n" +
                "kaj poste la loknomon.";
        }
    }
}

// ---------------- DATA PARSING ----------------

function parseDatumoj(dataString) {
    var components = [];
    var lines = dataString.trim().split('\n');

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.length === 0) {
            continue;
        }

        var parts = line.split(/\s+/);
        if (parts.length < 10) {
            continue;
        }

        var component = {
            nomo: parts[0],
            a: parseFloat(parts[1]),
            u: parseFloat(parts[2]) * Math.PI / 180,
            kh0s: parseFloat(parts[3]),
            ks: parseFloat(parts[4]),
            kh0: parseFloat(parts[5]),
            kpp: parseFloat(parts[6]),
            kns: parseFloat(parts[7]),
            kq: parseFloat(parts[8]),
            kn90: parseFloat(parts[9])
        };

        components.push(component);
    }

    return components;
}

function niv(zt1, tago, monato, jaro) {
    var zp = (zt1 - Math.floor(zt1)) * 5 / 3 + Math.floor(zt1);
    var gt = Math.floor(30.6001 * (1 + monato + 12 * Math.floor(1 / (monato + 1) + 0.7))) +
             Math.floor(365.25 * (jaro - Math.floor(1 / (monato + 1) + 0.7))) +
             tago + zp / 24 - 723258;

    var s = 78.16001 + 13.17639673 * gt;
    var h0 = 279.82 + 0.98564734 * gt;
    var pp = 349.5 + 0.11140408 * gt;
    var ns = 208.1 + 0.05295392 * gt;
    var n90 = 90;
    var q = 282.6 + 0.000047069 * gt;

    if (!datumojCache || datumojCacheSource !== aktualaDatumojTeksto) {
        datumojCache = parseDatumoj(aktualaDatumojTeksto);
        datumojCacheSource = aktualaDatumojTeksto;
    }

    var h2 = 0;

    for (var idx = 0; idx < datumojCache.length; idx++) {
        var c = datumojCache[idx];

        var argument = (c.kh0s * zp * 15 +
                        s * (c.ks - c.kh0s) +
                        h0 * (c.kh0 + c.kh0s) +
                        pp * c.kpp +
                        ns * c.kns +
                        q * c.kq +
                        n90 * c.kn90) * Math.PI / 180 - c.u;

        h2 += c.a * Math.cos(argument);

        if (c.nomo == 'M2') {
            argument = (c.kh0s * zp * 15 +
                        s * (c.ks - c.kh0s) +
                        h0 * (c.kh0 + c.kh0s) +
                        pp * c.kpp +
                        ns * (c.kns - 1) +
                        q * c.kq +
                        n90 * c.kn90) * Math.PI / 180 - c.u;
            h2 -= c.a / 27 * Math.cos(argument);
        }

        if (c.nomo == 'O1') {
            argument = (c.kh0s * zp * 15 +
                        s * (c.ks - c.kh0s) +
                        h0 * (c.kh0 + c.kh0s) +
                        pp * c.kpp +
                        ns * (c.kns - 1) +
                        q * c.kq +
                        n90 * c.kn90) * Math.PI / 180 - c.u;
            h2 += c.a / 5.3 * Math.cos(argument);
        }

        if (c.nomo == 'K1') {
            argument = (c.kh0s * zp * 15 +
                        s * (c.ks - c.kh0s) +
                        h0 * (c.kh0 + c.kh0s) +
                        pp * c.kpp +
                        ns * (c.kns + 1) +
                        q * c.kq +
                        n90 * c.kn90) * Math.PI / 180 - c.u;
            h2 += c.a / 7.4 * Math.cos(argument);
        }

        if (c.nomo == 'S2') {
            argument = (c.kh0s * zp * 15 +
                        s * (c.ks - c.kh0s) +
                        h0 * (c.kh0 + c.kh0s + 2) +
                        pp * c.kpp +
                        ns * (c.kns + 1) +
                        q * c.kq +
                        n90 * c.kn90) * Math.PI / 180 - c.u;
            h2 += c.a / 12 * Math.cos(argument);
        }
    }

    h2 = h2 / 100 + 0.0 / 100;
    return h2;
}

// ---------------- START ----------------

createCloudStore();
initializeInputFromCloudOrDefault();

script.createEvent('TouchStartEvent').bind(function(eventData) {
    onUpdateEvent(eventData);
    print("Bildschirm wurde berührt!");
});