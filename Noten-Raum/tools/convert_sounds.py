# Wandelt alle Sounds in sounds/_raw (OGG/WAV) in MP3 um (läuft überall, auch iPhone).
# Aufruf: blender.exe -b --python tools\convert_sounds.py -- sounds\_raw sounds
import aud, os, sys
src, dst = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    name, ext = os.path.splitext(f)
    if ext.lower() not in (".ogg", ".wav"):
        continue
    s = aud.Sound(os.path.join(src, f)).resample(44100, False).rechannel(1)
    out = os.path.join(dst, name + ".mp3")
    s.write(out, rate=44100, channels=aud.CHANNELS_MONO, format=aud.FORMAT_S16,
            container=aud.CONTAINER_MP3, codec=aud.CODEC_MP3, bitrate=96000)
    print("OK", out, os.path.getsize(out))
