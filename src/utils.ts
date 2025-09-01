import type { ParsedContent } from './types';

export const parseAIContent = (content: string): ParsedContent[] => {
  const results: ParsedContent[] = [];
  
  // Primary parsing: direct artifacts in content
  // Parse Python artifacts
  const pythonRegex = /<python_artifact>([\s\S]*?)<\/python_artifact>/g;
  let pythonMatch;
  while ((pythonMatch = pythonRegex.exec(content)) !== null) {
    const artifactContent = pythonMatch[1];
    const titleMatch = artifactContent.match(/<title>([\s\S]*?)<\/title>/);
    const codeMatch = artifactContent.match(/<code>([\s\S]*?)<\/code>/);
    if (titleMatch && codeMatch) {
      results.push({
        type: 'python_artifact',
        title: titleMatch[1],
        code: codeMatch[1].trim(),
        content: artifactContent
      });
    }
  }

  // Parse Chart artifacts (new schema)
  const chartRegex = /<chart_artifact>([\s\S]*?)<\/chart_artifact>/g;
  let chartMatch;
  while ((chartMatch = chartRegex.exec(content)) !== null) {
    const artifactContent = chartMatch[1];
    const titleMatch = artifactContent.match(/<title>([\s\S]*?)<\/title>/);

    // New style: Plotly or any HTML via CDN url
    const cdnUrlMatch = artifactContent.match(/<html_cdn_url>([\s\S]*?)<\/html_cdn_url>/);

    // Legacy nested echart_artifact with JSON options
    const echartMatch = artifactContent.match(/<echart_artifact>([\s\S]*?)<\/echart_artifact>/);

    if (titleMatch) {
      if (cdnUrlMatch) {
        results.push({
          type: 'chart_artifact',
          title: titleMatch[1],
          htmlCdnUrl: cdnUrlMatch[1].trim(),
          content: artifactContent
        });
        continue;
      }
      if (echartMatch) {
        const echartContent = echartMatch[1];
        const optionsMatch = echartContent.match(/<chart_options>([\s\S]*?)<\/chart_options>/);
        if (optionsMatch) {
          try {
            const chartOptions = JSON.parse(optionsMatch[1].trim());
            results.push({
              type: 'chart_artifact',
              title: titleMatch[1],
              chartOptions,
              content: echartContent
            });
          } catch (e) {
            console.error('Failed to parse chart options:', e);
          }
        }
      }
    }
  }

  // Backward compatibility: parse data_analysis_artifacts wrapper for python blocks
  const dataAnalysisRegex = /<data_analysis_artifacts>([\s\S]*?)<\/data_analysis_artifacts>/g;
  let dataAnalysisMatch;
  while ((dataAnalysisMatch = dataAnalysisRegex.exec(content)) !== null) {
    const artifactsContent = dataAnalysisMatch[1];
    let innerMatch;
    const innerPythonRegex = /<python_artifact>([\s\S]*?)<\/python_artifact>/g;
    while ((innerMatch = innerPythonRegex.exec(artifactsContent)) !== null) {
      const artifactContent = innerMatch[1];
      const titleMatch = artifactContent.match(/<title>([\s\S]*?)<\/title>/);
      const codeMatch = artifactContent.match(/<code>([\s\S]*?)<\/code>/);
      if (titleMatch && codeMatch) {
        results.push({
          type: 'python_artifact',
          title: titleMatch[1],
          code: codeMatch[1].trim(),
          content: artifactContent
        });
      }
    }
  }

  // Parse follow-up questions
  const followupRegex = /<followup_question>([\s\S]*?)<\/followup_question>/g;
  let followupMatch;
  while ((followupMatch = followupRegex.exec(content)) !== null) {
    const questionsContent = followupMatch[1];
    const questionMatches = questionsContent.match(/<question>([\s\S]*?)<\/question>/g);
    if (questionMatches) {
      const questions = questionMatches.map((q: string) => q.replace(/<\/?question>/g, '')).join('\n');
      results.push({
        type: 'followup_question',
        content: questions
      });
    }
  }

  // Extract regular text content (remove all artifacts we know about)
  let textContent = content
    .replace(/<data_analysis_artifacts>[\s\S]*?<\/data_analysis_artifacts>/g, '')
    .replace(/<chart_artifact>[\s\S]*?<\/chart_artifact>/g, '')
    .replace(/<python_artifact>[\s\S]*?<\/python_artifact>/g, '')
    .replace(/<followup_question>[\s\S]*?<\/followup_question>/g, '')
    .trim();

  if (textContent) {
    results.push({
      type: 'text',
      content: textContent
    });
  }

  return results;
};

export const parseStreamData = (data: string): any => {
  try {
    if (data.startsWith('data: ')) {
      return JSON.parse(data.substring(6));
    }
    return null;
  } catch (e) {
    console.error('Failed to parse stream data:', e);
    return null;
  }
};

export const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else {
    return 'Just now';
  }
};
