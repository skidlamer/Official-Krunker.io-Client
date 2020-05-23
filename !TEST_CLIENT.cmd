@echo off
cd src
IF EXIST "*.jsc" DEL "*.jsc" /s
npm run start --dev
exit