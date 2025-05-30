source "https://rubygems.org"

gem "jekyll", "~> 4.4.0"
gem "jekyll-feed", "~> 0.17"
gem "jekyll-sitemap", "~> 1.4"
gem "jekyll-paginate", "~> 1.1"

# 개발 환경 gems
group :development do
  gem "webrick", "~> 1.9"
end

# Windows 및 JRuby 환경 지원
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Windows 성능 향상을 위한 gem
gem "wdm", "~> 0.1", :platforms => [:mingw, :x64_mingw, :mswin]

# HTTP 서버 성능 개선
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby] 