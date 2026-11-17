cask "reqmate" do
  version "0.4.6"

  on_arm do
    url "https://github.com/anan2620/ReqMate/releases/download/v#{version}/ReqMate_aarch64.dmg",
        verified: "github.com/anan2620/ReqMate/"
    sha256 ""
  end

  on_intel do
    url "https://github.com/anan2620/ReqMate/releases/download/v#{version}/ReqMate_x64.dmg",
        verified: "github.com/anan2620/ReqMate/"
    sha256 ""
  end

  name "ReqMate"
  desc "Local-first API development platform"
  homepage "https://github.com/anan2620/ReqMate"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: ">= :monterey"

  app "ReqMate.app"

  zap trash: [
    "~/.reqmate",
    "~/Library/Application Support/dev.reqmate.app",
    "~/Library/Caches/dev.reqmate.app",
    "~/Library/Preferences/dev.reqmate.app.plist",
    "~/Library/Saved Application State/dev.reqmate.app.savedState",
  ]
end
