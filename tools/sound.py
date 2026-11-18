"""Synthesize the motor, fastener and gripper sounds in the film."""
from array import array
from math import exp, pi, sin, sqrt, tanh
from pathlib import Path
import os
import random
import subprocess
import sys

RATE = 44100
COUNT = round(599 / 30 * RATE)
ROOT = Path(__file__).resolve().parents[1]
randomizer = random.Random(91)
left = array("f", [0.0]) * COUNT
right = array("f", [0.0]) * COUNT


def place(index, sample, pan):
    if 0 <= index < COUNT:
        left[index] += sample * sqrt((1 - pan) * 0.5)
        right[index] += sample * sqrt((1 + pan) * 0.5)


def slide(start, end, low, high, level, pan):
    """Speed-dependent motor harmonics with a short acceleration and coast."""
    phase = 0.0
    airflow = 0.0
    length = int((end - start) * RATE)
    for i in range(length):
        u = i / length
        speed = sin(pi * u) ** 0.75
        phase += 2 * pi * (low + (high-low)*speed) / RATE
        airflow = 0.91 * airflow + 0.09 * randomizer.uniform(-1, 1)
        winding = sin(phase) + 0.36*sin(2*phase+0.12) + 0.18*sin(4*phase) + 0.085*sin(7*phase)
        sample = level * speed * (0.44*winding + 1.8*airflow)
        place(round(start * RATE)+i, sample, pan)


def seat(at, amplitude, pitch, pan):
    """Short metal impact with three independently decaying resonances."""
    last = 0.0
    for i in range(int(RATE*.21)):
        t = i/RATE
        noise = randomizer.uniform(-1,1)
        attack = (noise - .71*last)*exp(-t*470)
        last = noise
        ring = sin(2*pi*pitch*t)*exp(-t*65)
        ring += .39*sin(2*pi*pitch*2.61*t)*exp(-t*85)
        ring += .20*sin(2*pi*pitch*4.23*t)*exp(-t*108)
        place(round(at*RATE)+i, amplitude*(.57*attack+.43*ring),pan)


for start,end,frequency,volume,pan in [
    (1.35,2.77,196,.084,.02),(3.05,3.86,238,.074,.28),
    (4.43,5.49,181,.095,-.29),(5.96,6.69,247,.072,.30),
    (7.44,8.59,175,.094,-.31),(8.48,9.24,223,.080,.19),
    (9.99,11.14,191,.084,.34),(11.50,12.40,219,.092,-.36),
    (13.14,14.06,207,.088,.29),
]:
    slide(start, end, frequency*.51, frequency, volume, pan)
    seat(end-.018, volume*2.25, frequency*3.1,pan)

for start,quantity,step,pan in [
    (2.81,4,.058,.10),(4.49,7,.038,.25),(5.82,4,.040,.18),
    (7.48,8,.037,.18),(8.76,4,.043,-.27),(11.40,4,.046,.30),
    (13.13,5,.042,-.22),(14.52,4,.035,.33)
]:
    slide(start-.36,start+.05,530,890,.032,pan)
    for j in range(quantity):
        seat(start+j*step,.105 if j==0 else .052,870+(j%3)*131,pan+(j%3-1)*.08)

slide(14.73,15.53,136,271,.064,.29)
slide(16.08,17.87,96,302,.133,-.09)
slide(17.35,18.25,185,355,.057,-.25)
slide(18.75,19.91,117,277,.094,-.12)
seat(15.51,.054,830,.24)
seat(19.82,.075,716,-.22)

pcm = array("h")
room = 0.0
for i in range(COUNT):
    room = room*.981+.019*randomizer.uniform(-1,1)
    t = i/RATE
    bed = .0035*sin(2*pi*52*t)+.0018*sin(2*pi*104*t+.1)+room*.027
    fade = min(1, i/(RATE*.15), (COUNT-i)/(RATE*.12))
    # A short cross-channel reflection locates the sounds in the same studio.
    l = left[i]+(right[i-683]*.071 if i>=683 else 0)+bed
    r = right[i]+(left[i-1001]*.059 if i>=1001 else 0)+bed
    pcm.extend((round(tanh(l*2.3)*fade*32000),round(tanh(r*2.3)*fade*32000)))
if sys.byteorder != "little":
    pcm.byteswap()
subprocess.run([os.environ.get("FFMPEG_PATH","ffmpeg"),"-hide_banner","-loglevel","error","-y",
    "-f","s16le","-ar",str(RATE),"-ac","2","-i","pipe:0","-c:a","aac","-b:a","192k",
    str(ROOT/"assets"/"mechanism.m4a")],input=pcm.tobytes(),check=True)
