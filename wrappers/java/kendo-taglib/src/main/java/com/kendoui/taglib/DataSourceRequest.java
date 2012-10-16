package com.kendoui.taglib;

import java.util.HashMap;
import java.util.Map;
import java.util.List;

public class DataSourceRequest {
    private int page;
    private int pageSize;
    private int take;
    private int skip;
    private List<Map<String, String>> sort;
    private Map<String, Object> filter;
    
    public DataSourceRequest() {
        filter = new HashMap<String, Object>();
        
        List<Map<String, Object>> filters = new LazyList<Map<String, Object>>(new Factory<Map<String,Object>>() {
            public Map<String, Object> create() {
                Map<String, Object> result = new HashMap<String, Object>();
        
                List<Map<String, Object>> filters = new LazyList<Map<String, Object>>(new Factory<Map<String,Object>>() {
                    public Map<String, Object> create() {
                        return new HashMap<String, Object>();
                    }
                });
                
                result.put("filters", filters);
                
                return result; 
            }
        });
        
        filter.put("filters", filters);
    }
    
    public int getPage() {
        return page;
    }
    
    public void setPage(int page) {
        this.page = page;
    }
    
    public int getPageSize() {
        return pageSize;
    }
    
    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }

    public int getTake() {
        return take;
    }

    public void setTake(int take) {
        this.take = take;
    }

    public int getSkip() {
        return skip;
    }

    public void setSkip(int skip) {
        this.skip = skip;
    }

    public List<Map<String, String>> getSort() {
        return sort;
    }

    public void setSort(List<Map<String, String>> sort) {
        this.sort = sort;
    }

    public Map<String, Object> getFilter() {
        return filter;
    }

    public void setFilter(Map<String, Object> filter) {
        this.filter = filter;
    }

}
