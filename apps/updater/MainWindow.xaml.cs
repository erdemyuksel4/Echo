using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace EchoUpdater;

public partial class MainWindow : Window
{
    private const string RepoOwner = "erdemyuksel4";
    private const string RepoName = "Echo";
    private const string UserAgent = "Echo-Updater/1.0";

    private string? _targetVersion;
    private string? _downloadUrl;
    private string? _appPath;
    private CancellationTokenSource? _cancellationTokenSource;

    public MainWindow()
    {
        InitializeComponent();
        ParseArguments();
        Loaded += MainWindow_Loaded;
    }

    private void ParseArguments()
    {
        var args = Environment.GetCommandLineArgs();
        foreach (var arg in args)
        {
            if (arg.StartsWith("--target-version=", StringComparison.OrdinalIgnoreCase))
            {
                _targetVersion = arg.Substring("--target-version=".Length).Trim('"', '\'');
            }
            else if (arg.StartsWith("--download-url=", StringComparison.OrdinalIgnoreCase))
            {
                _downloadUrl = arg.Substring("--download-url=".Length).Trim('"', '\'');
            }
            else if (arg.StartsWith("--app-path=", StringComparison.OrdinalIgnoreCase))
            {
                _appPath = arg.Substring("--app-path=".Length).Trim('"', '\'');
            }
        }
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        StartUpdateFlow();
    }

    private void StartUpdateFlow()
    {
        _cancellationTokenSource?.Cancel();
        _cancellationTokenSource = new CancellationTokenSource();

        ErrorPanel.Visibility = Visibility.Collapsed;
        ProgressPanel.Visibility = Visibility.Visible;
        UpdateProgressBar.Value = 0;
        PercentTextBlock.Text = "%0";
        DownloadDetailsTextBlock.Text = "Bağlantı kuruluyor...";
        StatusTextBlock.Text = "En son sürüm GitHub üzerinden indiriliyor...";

        Task.Run(() => RunUpdateAsync(_cancellationTokenSource.Token));
    }

    private async Task RunUpdateAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(UserAgent);

            string downloadUrl = _downloadUrl ?? string.Empty;

            // Step 1: If no direct download URL is provided, query GitHub API
            if (string.IsNullOrWhiteSpace(downloadUrl))
            {
                UpdateStatus("GitHub sürümleri denetleniyor...", "Güncelleme bilgisi alınıyor...");
                downloadUrl = await ResolveDownloadUrlFromGitHubAsync(httpClient, _targetVersion, cancellationToken);
            }

            cancellationToken.ThrowIfCancellationRequested();

            // Step 2: Download the installer to temp folder
            string tempInstallerPath = Path.Combine(Path.GetTempPath(), "Echo-Update-Temp.exe");
            UpdateStatus("En son sürüm GitHub üzerinden indiriliyor...", "İndirme başlatılıyor...");

            await DownloadFileWithProgressAsync(httpClient, downloadUrl, tempInstallerPath, cancellationToken);

            cancellationToken.ThrowIfCancellationRequested();

            // Step 3: Run silent NSIS installer
            Dispatcher.Invoke(() =>
            {
                StatusTextBlock.Text = "Kuruluyor...";
                DownloadDetailsTextBlock.Text = "Lütfen bekleyin, kurulum tamamlanıyor...";
                UpdateProgressBar.Value = 100;
                PercentTextBlock.Text = "%100";
            });

            var startInfo = new ProcessStartInfo
            {
                FileName = tempInstallerPath,
                Arguments = "/S",
                UseShellExecute = true
            };

            using var installerProcess = Process.Start(startInfo);
            if (installerProcess != null)
            {
                await installerProcess.WaitForExitAsync(cancellationToken);
            }

            // Step 4: Launch updated Echo application
            LaunchEchoApp();

            // Step 5: Clean shutdown
            Dispatcher.Invoke(() =>
            {
                Application.Current.Shutdown();
            });
        }
        catch (OperationCanceledException)
        {
            // Update cancelled by user, safe to exit or stay quiet
        }
        catch (Exception ex)
        {
            Dispatcher.Invoke(() =>
            {
                StatusTextBlock.Text = "Güncelleme başarısız oldu";
                ErrorDetailsTextBlock.Text = ex.Message;
                ProgressPanel.Visibility = Visibility.Collapsed;
                ErrorPanel.Visibility = Visibility.Visible;
            });
        }
    }

    private async Task<string> ResolveDownloadUrlFromGitHubAsync(HttpClient httpClient, string? targetVersion, CancellationToken cancellationToken)
    {
        // Strategy 1: Direct latest.yml download from GitHub Releases (Zero rate limits, no 403!)
        try
        {
            string ymlUrl = $"https://github.com/{RepoOwner}/{RepoName}/releases/latest/download/latest.yml";
            var ymlResponse = await httpClient.GetAsync(ymlUrl, cancellationToken);
            if (ymlResponse.IsSuccessStatusCode)
            {
                string ymlContent = await ymlResponse.Content.ReadAsStringAsync(cancellationToken);
                var match = System.Text.RegularExpressions.Regex.Match(ymlContent, @"(?:path|url):\s*([^\r\n]+\.exe)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    string fileName = match.Groups[1].Value.Trim();
                    if (!string.IsNullOrWhiteSpace(targetVersion))
                    {
                        string tag = targetVersion.StartsWith('v') ? targetVersion : $"v{targetVersion}";
                        return $"https://github.com/{RepoOwner}/{RepoName}/releases/download/{tag}/{fileName}";
                    }
                    return $"https://github.com/{RepoOwner}/{RepoName}/releases/latest/download/{fileName}";
                }
            }
        }
        catch
        {
            // Fallback to API if direct latest.yml fails
        }

        // Strategy 2: GitHub REST API
        string apiUrl;
        if (!string.IsNullOrWhiteSpace(targetVersion))
        {
            string tag = targetVersion.StartsWith('v') ? targetVersion : $"v{targetVersion}";
            apiUrl = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/tags/{tag}";
        }
        else
        {
            apiUrl = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/latest";
        }

        var response = await httpClient.GetAsync(apiUrl, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            // If tag lookup failed and had 'v', try without 'v'
            if (!string.IsNullOrWhiteSpace(targetVersion) && targetVersion.StartsWith('v'))
            {
                string tagWithoutV = targetVersion.TrimStart('v');
                string fallbackUrl = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/tags/{tagWithoutV}";
                var fallbackResponse = await httpClient.GetAsync(fallbackUrl, cancellationToken);
                if (fallbackResponse.IsSuccessStatusCode)
                {
                    response = fallbackResponse;
                }
            }
        }

        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!root.TryGetProperty("assets", out var assets) || assets.GetArrayLength() == 0)
        {
            throw new InvalidOperationException("Yayınlanan sürümde kurulum dosyası varlığı bulunamadı.");
        }

        string? selectedUrl = null;

        // First attempt: Look for .exe with 'Setup' and 'Echo'
        foreach (var asset in assets.EnumerateArray())
        {
            if (asset.TryGetProperty("name", out var nameProp) &&
                asset.TryGetProperty("browser_download_url", out var urlProp))
            {
                string name = nameProp.GetString() ?? "";
                if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) &&
                    name.Contains("Setup", StringComparison.OrdinalIgnoreCase))
                {
                    selectedUrl = urlProp.GetString();
                    break;
                }
            }
        }

        // Second attempt: Any .exe asset
        if (string.IsNullOrEmpty(selectedUrl))
        {
            foreach (var asset in assets.EnumerateArray())
            {
                if (asset.TryGetProperty("name", out var nameProp) &&
                    asset.TryGetProperty("browser_download_url", out var urlProp))
                {
                    string name = nameProp.GetString() ?? "";
                    if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                    {
                        selectedUrl = urlProp.GetString();
                        break;
                    }
                }
            }
        }

        if (string.IsNullOrEmpty(selectedUrl))
        {
            throw new InvalidOperationException("Sürüm paketinde uyumlu bir Windows kurulum (.exe) dosyası bulunamadı.");
        }

        return selectedUrl;
    }

    private async Task DownloadFileWithProgressAsync(HttpClient httpClient, string downloadUrl, string destinationPath, CancellationToken cancellationToken)
    {
        using var response = await httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();

        long totalBytes = response.Content.Headers.ContentLength ?? -1L;

        if (File.Exists(destinationPath))
        {
            try { File.Delete(destinationPath); } catch { /* ignore if cleanup fails */ }
        }

        await using var contentStream = await response.Content.ReadAsStreamAsync(cancellationToken);
        await using var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);

        byte[] buffer = new byte[81920];
        long totalRead = 0;
        int bytesRead;

        var stopwatch = Stopwatch.StartNew();
        long lastRead = 0;
        var lastTime = stopwatch.Elapsed;

        while ((bytesRead = await contentStream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)) > 0)
        {
            await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
            totalRead += bytesRead;

            var currentTime = stopwatch.Elapsed;
            var elapsedSeconds = (currentTime - lastTime).TotalSeconds;

            if (elapsedSeconds >= 0.25 || (totalBytes > 0 && totalRead == totalBytes))
            {
                double speed = elapsedSeconds > 0 ? (totalRead - lastRead) / elapsedSeconds : 0;
                lastRead = totalRead;
                lastTime = currentTime;

                double progress = totalBytes > 0 ? ((double)totalRead / totalBytes) * 100.0 : 0;
                string progressText = totalBytes > 0
                    ? $"{FormatBytes(totalRead)} / {FormatBytes(totalBytes)} - {FormatBytes((long)speed)}/s"
                    : $"{FormatBytes(totalRead)} - {FormatBytes((long)speed)}/s";

                int displayPercent = (int)Math.Clamp(progress, 0, 100);

                Dispatcher.Invoke(() =>
                {
                    UpdateProgressBar.Value = displayPercent;
                    PercentTextBlock.Text = $"%{displayPercent}";
                    DownloadDetailsTextBlock.Text = progressText;
                });
            }
        }
    }

    private void LaunchEchoApp()
    {
        string? targetExe = null;

        if (!string.IsNullOrWhiteSpace(_appPath) && File.Exists(_appPath))
        {
            targetExe = _appPath;
        }
        else
        {
            string defaultPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "Echo", "Echo.exe");

            if (File.Exists(defaultPath))
            {
                targetExe = defaultPath;
            }
            else
            {
                string programFilesPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    "Echo", "Echo.exe");

                if (File.Exists(programFilesPath))
                {
                    targetExe = programFilesPath;
                }
            }
        }

        if (!string.IsNullOrEmpty(targetExe) && File.Exists(targetExe))
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = targetExe,
                UseShellExecute = true
            });
        }
    }

    private void UpdateStatus(string status, string details)
    {
        Dispatcher.Invoke(() =>
        {
            StatusTextBlock.Text = status;
            DownloadDetailsTextBlock.Text = details;
        });
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes < 0) return "0 B";
        string[] suffixes = { "B", "KB", "MB", "GB" };
        int i = 0;
        double d = bytes;
        while (d >= 1024 && i < suffixes.Length - 1)
        {
            d /= 1024.0;
            i++;
        }
        return $"{d:0.0} {suffixes[i]}";
    }

    private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ButtonState == MouseButtonState.Pressed)
        {
            DragMove();
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        _cancellationTokenSource?.Cancel();
        Application.Current.Shutdown();
    }

    private void RetryButton_Click(object sender, RoutedEventArgs e)
    {
        StartUpdateFlow();
    }
}
