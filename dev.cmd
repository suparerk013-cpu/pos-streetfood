@echo off
chcp 65001 >nul
title POS Dev
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1"
