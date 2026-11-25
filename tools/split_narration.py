"""Split one narration file at its long pauses into 30 clips: assets/vt/<lang>/<nn>.mp3"""
import os, re, subprocess, sys

lang, src = sys.argv[1], sys.argv[2]
out = f"/home/user/Kaztour/assets/vt/{lang}"
os.makedirs(out, exist_ok=True)
log = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "silencedetect=noise=-38dB:d=1.6", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
dur = float(re.search(r"Duration: (\d+):(\d+):([\d.]+)", log).group(3)) + 60 * int(re.search(r"Duration: (\d+):(\d+)", log).group(2))
assert len(starts) == len(ends) == 29, (len(starts), len(ends))
cuts = [0.0] + [(s + e) / 2 for s, e in zip(starts, ends)] + [dur]
for i in range(30):
    a, b = cuts[i], cuts[i + 1]
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", src,
                    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,afade=t=in:d=0.04",
                    "-ac", "1", "-ar", "44100", "-b:a", "64k", f"{out}/{i:02d}.mp3"], check=True)
print(lang, "ok", sum(os.path.getsize(f"{out}/{i:02d}.mp3") for i in range(30)) // 1024, "KB")
